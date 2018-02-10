(function(d3){

    // Some radians
    let rightAngle = Math.PI / 2, halfCircle = Math.PI, fullCircle = Math.PI * 2;

    // Canvas size
    let width = 1200, height = 900;

    // Mid-point of the canvas
    let canvasMidX = width / 2, canvasMidY = height / 2;

    // Currency bubble sizes
    let minBubble = 15, maxBubble = 50;

    // A scale to map overall score to a bubble size
    let bubbleScale = d3.scaleLinear()
        .domain([0, 1])
        .range([minBubble, maxBubble]);

    // Year ring radius
    let minRing = maxBubble*2, maxRing = (Math.min(width, height) / 2) - maxBubble;

    // Ring centre
    let midX = maxRing + 110, midY = canvasMidY;

    // Fixed rotation offset to give some clearance to the labels
    let yearClearance = Math.PI / 16, rotationOffset = yearClearance / 2;

    // The years and the year scale, to be set once the data is loaded
    let years = null, yearScale = null;

    // Currency font sizes
    let minFont = 9, maxFont = 20;
    
    // Map the overall score to font size
    let fontScale = d3.scaleLinear()
        .domain([0, 1])
        .range([minFont, maxFont]);

    // How is text positioned in the vertical axis
    // given the number of lines in the currency bubble
    let textLayoutMap = {
        1: [ 0.5 ],
        2: [ 0.35, 0.6 ],
        3: [ 0.3, 0.55, 0.75 ]
    };

    // The currency at the centre of the viz. BTC!
    let origin = null;

    class Currency {
        constructor(row) {
            this.code = row.Code;
            this.name = row.Name;
            this.year = +row.Inception;
            this.category = row.Category;
            this.type = row.Type;
            this.cap = parseNumber(row['Market Cap']);
            this.vol = parseNumber(row['30 Day Trade Volume']);
            this.fork = row['Hard-Fork Of'];
            this.similar = row['Similar To'];
        }

        radius() {
            return bubbleScale(this.overall);
        }
    }

    let layoutIterations = 10;
    let influenceRadius = maxBubble * 6;
    let adjustmentSpeed = 50, maxAdjustment = maxBubble;
    let clearZone = 0.1;

    // Insert the SVG element
    let svg = d3.select('#graphic')
                .append('svg')
                .attr('width', width)
                .attr('height', height);

    function parseNumber(x) {
        return Number(x.trim().replace(/,/g, ''));
    }

    function sortCurrencies(a, b)
    {
        if(a.category !== b.category) {
            return a.category < b.category ? -1 : 1;
        }

        if(a.year === b.year) return 0;
        return (a.year < b.year) ? -1 : 1;
    }

    function enrichData(data)
    {
        data.sort(sortCurrencies);
        
        // Maximum Total Market Cap and 30 Day Volume
        let maxCap = d3.max(data, x => x.cap);
        let maxVol = d3.max(data, x => x.vol);

        // Calculate the percentage of the total cap, and total volume
        data.forEach(x => {
            x.capScore = (x.cap / maxCap);
            x.volScore = (x.vol / maxVol);
            // Calculate "overall" as a 2:1 ratio of cap:vol
            x.overall = (2 * x.capScore) + x.volScore;            
        });

        // Re-map using a log scale
        let overallScale = d3.scaleLog()
            .base(1.1)
            .domain([d3.min(data, x => x.overall), d3.max(data, x => x.overall)])
            .range([0, 1]);

        let scoreScale = d3.scaleLog()
            .base(1.1)
            .clamp(true)
            .domain([0.01, 1])
            .range([0, 1]);

        data.forEach(x => {
            x.capScore = scoreScale(x.capScore);
            x.volScore = scoreScale(x.volScore);
            x.overall = overallScale(x.overall);
        });
    }

    function setYears(data)
    {
        // How many distinct years are there?
        years = [...new Set(data.filter(x => x.code !== origin.code).map(x => x.year))];
        years.sort();

        // Map the year to a ring radius
        yearScale = d3.scaleLinear()
            .domain([years[0], years[years.length - 1]])
            .range([minRing, maxRing]);
    }

    function drawGraphic(data)
    {
        // Single out bitcoin, because it's in the center and treated slightly different
        origin = data.find(x => x.code === 'BTC');

        // Work out how many years we have
        setYears(data);

        // Group the currencies by category
        let byCategory = data.reduce((memo, val) => { 
            if(val.code === origin.code) return memo;
            memo[val.category] = memo[val.category] || [];
            memo[val.category].push(val);
            return memo;
        }, {});

        // Divide the total circle based on the number of currencies in each category
        // Giving a little bit of extra room for the year legend
        // and ignoring BTC because it isn't in a category
        let perBubble = (fullCircle - yearClearance) / (data.length - 1);
        let angle = rotationOffset;

        // Build the arcs for each category
        for(let c in byCategory) {
            let cat = byCategory[c];
            cat.category = c;
            cat.startAngle = angle;
            cat.endAngle = angle + (perBubble * cat.length);
            drawCategoryArc(cat);
            angle = cat.endAngle;
        }

        // Draw the year rings and legend
        drawYears(years);

        // Draw the Bitcoin Bubble (ha!)
        drawBubble(origin, midX, midY);
        
        // Draw the bubbles within each category
        for(let c in byCategory) {
            drawCategoryBubbles(byCategory[c]);            
        }
    }

    function drawCategoryArc(cat)
    {
        let catArc = d3.arc()
            .innerRadius(0)
            .outerRadius(maxRing + 2*maxBubble)
            .startAngle(rightAngle - cat.startAngle)
            .endAngle(rightAngle - cat.endAngle);

        let catArcPath = svg.append('path')
            .attr('d', catArc())
            .attr('transform', `translate(${midX} ${midY})`)
            .attr('class', `category category-${cat.category}`);
    }

    function drawYears(years)
    {
        // Draw the year rings
        years.forEach(y => {
            svg.append('circle')
               .attr('cx', midX)
               .attr('cy', midY)
               .attr('r', yearScale(y))
               .attr('class', 'year-ring');
        });
        
        // Disrupt the rings briefly so the year labels are easier to read
        svg.append('rect')
           .attr('width', midX)
           .attr('height', minBubble * 2)
           .attr('x', midX)
           .attr('y', midY - minBubble)
           .attr('class', 'year-clearance');

        // Draw the year labels
        let lastX = 0;
        years.forEach(y => {
            lastX = midX + yearScale(y);
            svg.append('text')
               .attr('x', lastX)
               .attr('y', midY)
               .text(y)
               .attr('class', 'year-label');
        });

        svg.append('text')
            .attr('x', lastX + 50)
            .attr('y', midY)
            .text('Inception')
            .attr('class', 'year-caption');
    }

    function drawCategoryBubbles(cat)
    {
        // How much space do we have for this category?
        let sweep = cat.endAngle - cat.startAngle;

        // Leave some space along the edge of the arc
        let minAngle = cat.startAngle + (sweep * clearZone);
        let maxAngle = cat.endAngle - (sweep * clearZone);
        sweep = maxAngle - minAngle;

        let midPoint = minAngle + 0.5 * sweep;

        let years = new Set();
        let layout = [];

        // Choose some initial positions for the bubbles
        let perBubble = sweep / cat.length;
        let i = 0;

        cat.forEach(currency => {
            let radius = yearScale(currency.year);
            let angle = minAngle + (i * perBubble) + (perBubble / 2);
            layout.push(new Arrangeable(currency, radius, angle));

            // If we haven't seen this year before, add an edge on the ring
            if(!years.has(currency.year)) {
                let leadingEdge = { isEdge: true, code: 'Leading Edge', criticalAngle: -midPoint }
                layout.push(new Arrangeable(leadingEdge, radius, minAngle));

                let trailingEdge = { isEdge: true, code: 'Trailing Edge', criticalAngle: midPoint }
                layout.push(new Arrangeable(trailingEdge, radius, maxAngle));

                years.add(currency.year);
            }

            i++;
        });

        for(i = 0; i < layoutIterations; i++) {
            let falloff = 1 - (i/layoutIterations);
            layout.forEach(x => {
                // You can't move the edges, only the currencies
                if(!x.thing.isEdge) {
                    // We will only move the bubble forwards and backwards
                    // perpendicular to its radial position
                    let attack = fromPolar([1, x.polar[1] + rightAngle]);

                    let force = [0, 0];
                    layout.forEach(y => {
                        // I can't exert a force on myself
                        if(x.id !== y.id) {
                            force = vectorAdd(force, y.pushOther(x, attack));
                        }
                    });

                    // Clamp the maximum movement
                    force = toPolar(force);
                    if(force[0] > maxAdjustment) {
                        force[0] = maxAdjustment;
                    }

                    // Apply the falloff
                    force[0] = force[0] * falloff;

                    x.step = fromPolar(force);
                }
            });

            // Let all of the steps resolve, then apply the movement
            layout.forEach(x => {
                // You can't move the edges, only the currencies
                if(!x.thing.isEdge) {
                    // Apply the step movement to the current position
                    let endPos = vectorAdd(x.step, x.cartesian);
                    endPos = normalisePolar(toPolar(endPos));

                    let angle = endPos[1];
                    if(angle > maxAngle) {
                        console.log(`Too far`);
                        angle = maxAngle;
                    } else if (angle < minAngle) {
                        console.log(`Too short`);
                        angle = minAngle;
                    }

                    // Take the angle (but not the radius) from the end position
                    x.setPolar(x.polar[0], angle);
                }
            });
        }

        layout.forEach(x => {
            // You can't move the edges, only the currencies
            if(!x.thing.isEdge) {
                console.log(`Final point: ${x.thing.code} ${toDegrees(x.polar[1])}`);

                //let yearRadius = yearScale(currency.year);
                
                // Calculate the position of the bubble
                let bubbleX, bubbleY;
                [bubbleX, bubbleY] = toScreenSpace(x.cartesian, [midX, midY]);

                drawBubble(x.thing, bubbleX, bubbleY);
            }
        });
    }

    class Arrangeable {
        constructor(thing, radius, angle) {
            this.id = Arrangeable.nextId++;
            this.thing = thing;
            this.setPolar(radius, angle);
        }

        setPolar(radius, angle) {
            this.polar = [radius, angle];
            this.cartesian = normalisePolar(fromPolar(this.polar));
        }

        pushOther(other, attack) {
            // Ignore edges which are beyond the critical angle
            if(this.thing.isEdge) {
                let criticalAngle = this.thing.criticalAngle;

                let shouldIgnore = (criticalAngle < 0 && other.polar[1] > -1 * criticalAngle)
                                || (criticalAngle > 0 && other.polar[1] < criticalAngle);

                if(shouldIgnore) {
                    console.log(`${this.thing.code} ignored for ${other.thing.code}.`)
                    return [0, 0];
                }
            }

            // How far away is the other item
            let dist = vectorMinus(other.cartesian, this.cartesian);
            dist = toPolar(dist);

            // Too far away
            if(dist[0] > influenceRadius) {
                return [0, 0];
            }

            // Clamp the minimum distance
            if(dist[0] <= 1) {
                dist[0] = 1;
            }

            let escape = this.getEscapeFactorFor(other);
            escape = escape * adjustmentSpeed;

            // Use inverse squared distance for the force
            let push = [escape/(dist[0] * dist[0]),  dist[1]];
            push = fromPolar(push);
            
            // Apply the force to the angle of attack
            push = vectorMultiply(attack, vectorDot(push, attack));
            push = toPolar(push);

            // Clamp to minimum and maximum force
            if(push[0] > maxAdjustment) {
                push[0] = maxAdjustment;
            } else if (push[0] < 1) {
                push[0] = 1;
            }

            return fromPolar(push);
        }

        getEscapeFactorFor(other) {
            // I'm an edge
            if(this.thing.isEdge) {
                return 0.5 * maxBubble * maxBubble;
            }

            if(other.thing.isEdge) {
                throw 'This should never happen.';
            }

            let sum = this.thing.radius() + other.thing.radius();
            return sum * sum;
        }

    }

    Arrangeable.nextId = 1;

    function fromPolar(vect)
    {
        return [
            (vect[0] * Math.cos(vect[1])),
            (vect[0] * Math.sin(vect[1]))
        ];
    }

    function toPolar(vect)
    {
        return [
            Math.sqrt(vect[0]*vect[0] + vect[1]*vect[1]),
            Math.atan2(vect[1], vect[0])
        ];
    }

    function toScreenSpace(vect, midPoint)
    {
        return vectorAdd(midPoint, [vect[0], -vect[1]]);
    }

    function normalisePolar(vect)
    {
        return [
            vect[0],
            vect[1] < 0 ? fullCircle + vect[1] : vect[1]
        ];
    }

    function vectorAdd(a, b)
    {
        return [a[0] + b[0], a[1] + b[1]];
    }

    function vectorMinus(a, b)
    {
        return [a[0] - b[0], a[1] - b[1]];
    }

    function vectorMultiply(x, scalar)
    {
        return [x[0] * scalar, x[1] * scalar];
    }

    function vectorDot(a, b)
    {
        return (a[0] * b[0]) + (a[1] * b[1]);
    }

    function toDegrees (angle) {
        return (angle * (180 / Math.PI)).toFixed(2);
      }

    function drawBubble(currency, bubbleX, bubbleY)
    {
        // Calculate the radius of the bubble based on the overall score
        let bubbleRadius = currency.radius();

        // Draw the white background of the bubble
        let background = svg.append('circle')
            .attr('cx', bubbleX)
            .attr('cy', bubbleY)
            .attr('r', bubbleRadius)
            .attr('class', 'c-background');

        // Draw the Market Cap and Trading Volume Arcs
        drawScoreArc(bubbleX, bubbleY, bubbleRadius, currency.capScore, 'right', 'c-cap-arc');
        drawScoreArc(bubbleX, bubbleY, bubbleRadius, currency.volScore, 'left', 'c-vol-arc');

        // Draw the outline of the bubble
        let outline = svg.append('circle')
            .attr('cx', bubbleX)
            .attr('cy', bubbleY)
            .attr('r', bubbleRadius)
            .attr('class', 'c-outline');
        
        // Calculate the font size based on the overall score
        let fontSize = fontScale(currency.overall);

        // A scale for laying out lines of text vertically through the bubble
        // 0: Top of the bubble; 1: Bottom of the bubble.
        let textLayout = d3.scaleLinear()
            .domain([0, 1])
            .range([bubbleY - bubbleRadius, bubbleY + bubbleRadius]);

        // Work out how many lines of text to draw
        let nameParts = currency.name.split(' ');
        let noName = (currency.code === currency.name.toUpperCase() || bubbleRadius < 18);
        let lineCount = noName ? 1 : nameParts.length + 1;
        let lineLayout = (i) => textLayout(textLayoutMap[lineCount][i]);

        // Draw the currency code
        let code = svg.append('text')
            .text(currency.code)
            .attr('x', bubbleX)
            .attr('y', lineLayout(0))
            .style('font-size', fontSize)
            .attr('class', 'c-code');
        
        if(!noName) {
            // Draw the first line of the name
            let name1 = svg.append('text')
                .text(nameParts[0])
                .attr('x', bubbleX)
                .attr('y', lineLayout(1))
                .style('font-size', fontSize * 0.8)
                .attr('class', 'c-name');

            // Draw the second line of the name if it exists
            if(nameParts.length > 1) {
                let name2 = svg.append('text')
                .text(nameParts[1])
                .attr('x', bubbleX)
                .attr('y', lineLayout(2))
                .style('font-size', fontSize * 0.8)
                .attr('class', 'c-name');
            }
        }
    }

    function drawScoreArc(bubbleX, bubbleY, bubbleRadius, score, direction, klass)
    {
        if(score === 0) {
            return;
        }

        var arcLength = (halfCircle * score);

        arcLength = (direction == 'right') ? -arcLength : arcLength;

        let capArc = d3.arc()
            .innerRadius(0.85 * bubbleRadius)
            .outerRadius(bubbleRadius)
            .startAngle(halfCircle)
            .endAngle(halfCircle + arcLength);

        let capArcPath = svg.append('path')
            .attr('d', capArc())
            .attr('transform', `translate(${bubbleX} ${bubbleY})`)
            .attr('class', klass);
    }

    d3.csv('data.csv', row => new Currency(row)).then(data => {
        enrichData(data);
        drawGraphic(data);
    });


})(window.d3);