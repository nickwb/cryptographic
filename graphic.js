(function(d3){

    let rightAngle = Math.PI / 2, halfCircle = Math.PI, fullCircle = Math.PI * 2;

    // Canvas size
    let width = 1200, height = 900;

    // Mid-point of the canvas
    let midX = width / 2, midY = height / 2;

    // Currency bubble sizes
    let minBubble = 15, maxBubble = 50;
    let minFont = 10, maxFont = 20;

    // Year ring radius
    let minRing = maxBubble*2, maxRing = (Math.min(width, height) / 2) - maxBubble;

    // Fixed rotation offset to give some clearance to the labels
    let yearClearance = Math.PI / 16, rotationOffset = yearClearance / 2;

    // How is text positioned in the vertical axis
    // given the number of lines in the currency bubble
    let textLayoutMap = {
        1: [ 0.5 ],
        2: [ 0.35, 0.6 ],
        3: [ 0.3, 0.55, 0.75 ]
    };

    let layoutIterations = 5;

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
        if(a.year === b.year) return 0;
        return (a.year < b.year) ? -1 : 1;
    }

    function enrichData(data)
    {
        // Sort currencies by age
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

    let btc = null;
    let yearScale = null;
    let bubbleScale = null;
    let textScale = null;

    function drawGraphic(data)
    {
        // Single out bitcoin, because it's in the center and treated slightly different
        btc = data.find(x => x.code === 'BTC');

        // Group the currencies by category
        let byCategory = data.reduce((memo, val) => { 
            if(val.code === btc.code) return memo;
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

        // How many distinct years are there?
        let years = [...new Set(data.filter(x => x.code !== btc.code).map(x => x.year))];
        years.sort();

        // Map the year to a ring radius
        yearScale = d3.scaleLinear()
            .domain([years[0], years[years.length - 1]])
            .range([minRing, maxRing]);

        // Draw the year rings and legend
        drawYears(years);

        // Map the overall score to a bubble size
        bubbleScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minBubble, maxBubble]);

        // Map the overall score to text size
        textScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minFont, maxFont]);

        // Draw the Bitcoin Bubble (ha!)
        drawBubble(btc, 0);
        
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
        console.log(`Start: ${toDegrees(cat.startAngle)}, End: ${toDegrees(cat.endAngle)}`);

        // How much space do we have for this category?
        let sweep = cat.endAngle - cat.startAngle;

        // Leave some space along the edge of the arc
        let minAngle = cat.startAngle + (sweep * 0.1);
        let maxAngle = cat.endAngle - (sweep * 0.1);
        sweep = maxAngle - minAngle;

        console.log(`Min: ${toDegrees(minAngle)}, Max: ${toDegrees(maxAngle)}`);

        let years = new Set();
        let edge = { isEdge: true };
        let shove = [];

        // Choose some initial positions for the bubbles
        let perBubble = sweep / cat.length;
        let i = 0;

        cat.forEach(currency => {
            let radius = yearScale(currency.year);
            let angle = minAngle + (i * perBubble) + (perBubble / 2);
            shove.push(new Arrangeable(currency, radius, angle));

            // If we haven't seen this year before, add an edge on the ring
            if(!years.has(currency.year)) {
                shove.push(new Arrangeable(edge, radius, minAngle));
                shove.push(new Arrangeable(edge, radius, maxAngle));
                years.add(currency.year);
            }

            i++;
        });

        for(i = 0; i < layoutIterations; i++) {
        //for(i = 0; i < 0; i++) {
            let learningRate = 1 - (i/layoutIterations);
            console.log(`Learning Rate: ${learningRate}`);
            shove.forEach(x => {
                // You can't move the edges, only the currencies
                if(!x.thing.isEdge) {
                    console.log(`Moving ${x.thing.code}`);

                    // We will only move the bubble forwards and backwards
                    // perpendicular to its radial position
                    let attack = fromPolar([1, x.polar[1] + rightAngle]);

                    let force = [0, 0];
                    shove.forEach(y => {
                        // I can't exert a force on myself
                        if(x.id !== y.id) {
                            force = vectorAdd(force, y.pushOther(x, attack));
                        }
                    });

                    // Clamp the maximum movement
                    force = toPolar(force);
                    if(force[0] > maxBubble) {
                        force[0] = maxBubble;
                    }

                    // Apply the learning rate
                    force[0] = force[0] * learningRate;

                    console.log(`Net force: ${force[0]} ${toDegrees(force[1])}`);

                    x.step = fromPolar(force);
                }
            });

            // Let all of the steps resolve, then apply the movement
            shove.forEach(x => {
                // You can't move the edges, only the currencies
                if(!x.thing.isEdge) {
                    let pStep = toPolar(x.step);
                    console.log(`${x.thing.code} Step: ${pStep[0]} ${toDegrees(pStep[1])}`);

                    // Apply the step movement to the current position
                    let endPos = vectorAdd(x.step, x.cartesian);
                    endPos = toPolar(endPos);

                    console.log(`End Pos: ${endPos[0]} ${toDegrees(endPos[1])}`);

                    let angle = endPos[1];
                    if(angle > maxAngle) {
                        console.log(`Too far`);
                        angle = maxAngle;
                    } else if (angle < minAngle) {
                        console.log(`Too short`);
                        angle = minAngle;
                    }

                    console.log(`Moving to: ${angle}`);

                    // Take the angle (but not the radius) from the end position
                    x.setPolar(x.polar[0], angle);
                }
            });
        }

        shove.forEach(x => {
            // You can't move the edges, only the currencies
            if(!x.thing.isEdge) {
                console.log(`Final point: ${x.thing.code} ${toDegrees(x.polar[1])}`);
                drawBubble(x.thing, x.polar[1]);
            }
        });
    }

    class Arrangeable {
        constructor(thing, radius, angle) {
            this.id = Arrangeable.nextId++;
            //console.log(`id: ${this.id}`);
            this.thing = thing;
            this.setPolar(radius, angle);
        }

        setPolar(radius, angle) {
            this.polar = [radius, angle];
            this.cartesian = fromPolar(this.polar);
        }

        setCartesian(x, y) {
            this.cartesian = [x, y];
            this.polar = toPolar(this.cartesian);
        }

        pushOther(other, attack) {
            let dist = vectorMinus(other.cartesian, this.cartesian);
            dist = toPolar(dist);

            // Too far away
            if(dist[0] > 3*maxBubble) {
                return [0, 0];
            }

            // Clamp the minimum distance
            if(dist[0] <= 1) {
                dist[0] = 1;
            }

            //console.log(`Dist: ${dist[0]}, ${dist[1]}`);

            let mass = this.getMassRelativeTo(other);
            console.log(`Mass ${this.thing.code || 'Edge'}: ${mass.toFixed(0)}`);
            //let mass = 100;
            let factor = mass * 50;

            // Use inverse squared distance for the force
            let push = [factor/(dist[0] * dist[0]),  dist[1]];
            push = fromPolar(push);
            
            // Apply the force to the angle of attack
            push = vectorMultiply(attack, vectorDot(push, attack));
            push = toPolar(push);

            // Clamp to minimum and maximum force
            if(push[0] > maxBubble) {
                push[0] = maxBubble;
            } else if (push[0] < 1) {
                push[0] = 1;
            }
            
            console.log(`${this.thing.code || 'Edge'} Push: ${push[0]}, ${toDegrees(push[1])}`);

            return fromPolar(push);
        }

        getMassRelativeTo(other) {
            // I'm an edge, and I'm an immovable object
            if(this.thing.isEdge) {
                return maxBubble * maxBubble;
            }

            if(other.thing.isEdge) {
                throw 'This should never happen.';
            }

            let netMass = getBubbleRadius(this.thing) + getBubbleRadius(other.thing);
            return netMass * netMass;

            // // We're both movable, so the bigger guy wins
            // let myMass = getBubbleRadius(this.thing),
            //     hisMass = getBubbleRadius(other.thing),
            //     minMass = Math.min(hisMass, myMass);

            // return (myMass - hisMass) + minMass;
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

    function getBubbleRadius(currency) {
        return bubbleScale(currency.overall);
    }

    function toDegrees (angle) {
        return (angle * (180 / Math.PI)).toFixed(2);
      }

    function drawBubble(currency, angle)
    {
        let yearRadius = yearScale(currency.year);
        
        // Calculate the position of the bubble
        let bubbleX, bubbleY;
        [bubbleX, bubbleY] = toScreenSpace(fromPolar([yearRadius, angle]), [midX, midY]);

        // BTC always in the centre...
        if(currency.code === btc.code) {
            bubbleX = midX;
            bubbleY = midY;
        }

        // Calculate the radius of the bubble based on the overall score
        let bubbleRadius = getBubbleRadius(currency);

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
        let fontSize = textScale(currency.overall);

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

    d3.csv('data.csv', row => {
        return {
            code: row.Code,
            name: row.Name,
            year: +row.Inception,
            category: row.Category,
            type: row.Type,
            cap: parseNumber(row['Market Cap']),
            vol: parseNumber(row['30 Day Trade Volume']),
            fork: row['Hard-Fork Of'],
            similar: row['Similar To']
        };
    }).then(data => {
        enrichData(data);
        drawGraphic(data);
    });


})(window.d3);