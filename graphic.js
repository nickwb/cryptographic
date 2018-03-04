(function(d3){

    // Date on the chart
    let when = 'March 3, 2018';

    // Some radians
    let rightAngle = Math.PI / 2, halfCircle = Math.PI, fullCircle = Math.PI * 2;

    // Canvas size
    let width = 1300, height = 900;

    // Mid-point of the canvas
    let canvasMidX = width / 2, canvasMidY = height / 2;

    // Master margin
    let margin = 10;

    // Currency bubble sizes
    let minBubble = 15, maxBubble = 50;

    // A scale to map overall score to a bubble size
    let bubbleScale = d3.scaleLinear()
        .domain([0, 1])
        .range([minBubble, maxBubble]);

    // Year ring radius
    let minRing = maxBubble*2, maxRing = (Math.min(width, height) / 2) - maxBubble;

    // Ring centre
    let midX = maxRing + (2*maxBubble) + margin, midY = canvasMidY;

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

    // Bubble arrangement
    let minSlice = Math.PI / 25, halfSlice = minSlice / 2;
    let basicSeparation = 10, goodSeparation = 40;
    let similarTether = 100;

    // Legends
    let topN = 5;

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
            this.fork = Currency.getCode(row['Hard-Fork Of']);
            this.similar = Currency.getSimilarMap(row['Similar To']);

            this._radius = null;
            this._fromCentre = null;
        }

        static getCode(str) {
            return String(str).trim().toUpperCase();
        }

        static getSimilarMap(str) {
            let codes = String(str).split(/[^a-zA-Z]+/);
            codes = codes.map(x => Currency.getCode(x)).filter(x => x.length > 0);
            let similar = {};
            codes.forEach(x => similar[x] = true);
            return similar;
        }

        radius() {
            return (this._radius === null) 
                ? (this._radius = bubbleScale(this.overall))
                : this._radius; 
        }

        fromCentre() {
            return (this._fromCentre === null) 
                ? (this._fromCentre = yearScale(this.year))
                : this._fromCentre; 
        }
    }

    // Sort currencies different ways
    function makeSorter(...fields)
    {
        return (a, b) => {
            for(let i = 0; i < fields.length; i++) {
                let f = fields[i];
                if(a[f] === b[f]) continue;
                return a[f] < b[f] ? -1 : 1;
            }

            return 0;
        };
    }

    let sorter = {
        age: makeSorter('year'),
        cap: makeSorter('cap'),
        vol: makeSorter('vol'),
        categoryAndAge: makeSorter('category', 'year')
    };

    Array.prototype._orderBy = function(sorter) {
        let clone = this.slice(0);
        clone.sort(sorter);
        return clone;
    };

    // Insert the SVG element
    let svg = d3.select('#graphic')
                .append('svg')
                .attr('width', width)
                .attr('height', height);

    function parseNumber(x) {
        if(x === null || x === undefined) return 0;
        return Number(x.trim().replace(/,/g, ''));
    }    

    function enrichData(data)
    {
        data.sort(sorter.categoryAndAge);
        
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
        origin = data._orderBy(sorter.age)[0];

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

        // Draw the title and legends
        drawTitleAndLegends(data);
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
        let ctx = new ArrangementContext(cat);

        //debugArrangement(ctx);        

        let bestScore = 0;
        let bestArrangement = null;

        for(let x of recursiveArrange(ctx, 0)) {
            let score = x.score();
            if(score > bestScore) {
                bestScore = score;
                bestArrangement = x;
            }
        }

        let mid = [midX, midY];
        for(let i = 0; i < ctx.count; i++) {
            let item = bestArrangement.item(i);
            let bubble = item.bubble();
            let pos = item.position();
            pos = toScreenSpace(pos, mid);
            drawBubble(bubble, pos[0], pos[1]);
        }
    }

    function debugArrangement(ctx)
    {
        let center = [midX, midY];

        for(let i = 0; i < ctx.slices; i++) {
            let theta = ctx.angleAt(i);
            for(let j = 0; j < years.length; j++) {
                let r = yearScale(years[j]);

                let pos = [ (r * Math.cos(theta)),  (r * Math.sin(theta)) ];
                pos = toScreenSpace(pos, center);

                svg.append('circle')
                    .attr('cx', pos[0])
                    .attr('cy', pos[1])
                    .attr('r', 3)
                    .attr('class', 'c-background');
            }
        }
    }

    function* recursiveArrange(context, n) {
        if(n === context.count) {
            yield new Arrangement(context);
            return;
        }

        for(let i = 0; i < context.slices; i++) {
            let angle = context.angleAt(i);
            let children = recursiveArrange(context, n + 1);
            for(let j of children) {
                j.addAt(n, angle);
                yield j;
            }
        }
    }

    class ArrangementContext {
        constructor(category) {
            this.start = category.startAngle;
            this.end = category.endAngle;
            this.sweep = category.endAngle - category.startAngle;
            this.mid = this.start + (this.sweep / 2);

            // How many slices can we fit in to thie category.
            // Use an odd number, so we get central alignment
            this.slices = Math.floor(this.sweep / minSlice);
            this.slices = (this.slices % 2) == 0 ? this.slices - 1: this.slices;

            let sliceSweep = this.slices * minSlice;

            this.offset = (this.sweep - sliceSweep) * 0.5 + category.startAngle + halfSlice;
            
            this.bubbles = category;
            this.count = category.length;

            this.years = new Set(category.map(x => x.year));
            this.yearMap = null;
            this.fillYearMap();
        }

        fillYearMap() {
            let map = new Map();
            for(let i = 0; i < this.bubbles.length; i++) {
                let year = this.bubbles[i].year;
                let indices = map.has(year) ? map.get(year) : [];
                indices.push(i);
                map.set(year, indices); 
            }
            this.yearMap = map;
        }

        angleAt(slice) {
            return (slice * minSlice) + this.offset;
        }
    }

    class Arrangement {
        constructor(context) {
            this.context = context;
            this.angles = [];
            this.lazyItem = new Map();
        }

        addAt(idx, angle) {
            this.angles.push(angle);
        }

        item(i) {
            let item = this.lazyItem.get(i);
            if(!item) {
                item = new ArrangedItem(this, i, this.angles[i]);
                this.lazyItem.set(i, item);
            }
            return item;
        }

        score() {
            let radial = this.getRadialSpreadScore();
            let separation = this.getSeparationScore();
            let edges = this.getEdgesScore();
            let centroid = this.getCentroidScore();
            return (radial) + (separation) + (edges) + (centroid);
        }

        getRadialSpreadScore() {
            let sweep = this.context.sweep;
            let sweepError = (1 + sweep);
            let score = 0, maxScore = 0, error = 0;
            for(let year of this.context.years) {
                let ringMembers = this.anglesInYear(year);
                let avg = 0;
                let distances = [];

                for(let i = 1; i < ringMembers.length; i++) {
                    let move = ringMembers[i] - ringMembers[i - 1];
                    avg += move;
                    distances.push(move);
                }

                avg = avg/(ringMembers.length - 1);

                for(let i = 1; i < distances.length; i++) {
                    error = 1 * Math.abs(avg - distances[i]);
                    score += error;
                    maxScore += sweepError;
                }
            }

            // if(score < 0 || score > maxScore || Number.isNaN(score)) {
            //     throw 'Unexpected radial score';
            // }

            return 1 - (score / maxScore);
        }

        anglesInYear(year) {
            let result = this.context.yearMap.get(year).map(x => this.angles[x]);
            result.push(this.context.start);
            result.push(this.context.end);
            result.sort();
            return result;
        }

        getSeparationScore() {
            let maxScore = 0, score = 0;
            for(let i = 0; i < this.context.count; i++) {
                for(let j = i; j < this.context.count; j++) {
                    if(i === j) continue;

                    let a = this.item(i), b = this.item(j);
                    let separation = this.getSeparation(a, b);

                    maxScore += 1;
                    
                    if(a.isSimilarTo(b) && separation > basicSeparation && separation < similarTether) {
                        // Full marks for similarity matching
                        score += 1
                    }
                    if(separation > goodSeparation) {
                        // Good marks for good separation
                        score += 0.75;
                    } else if (separation > basicSeparation) {
                        // Part marks for a little separation
                        score += 0.5;
                    } else if (separation < 0) {
                        // Severely penalise overlapping bubbles
                        maxScore += 10;
                    }
                }
            }

            // if(score < 0 || score > maxScore || Number.isNaN(score)) {
            //     throw 'Unexpected separation score';
            // }

            return score/maxScore;
        }

        getSeparation(a, b) {
            let distance = a.distanceTo(b);
            distance -= a.bubble().radius() + b.bubble().radius();
            return distance;
        }

        getEdgesScore() {
            let score = 0;
            for(let i = 0; i < this.context.count; i++) {
                let clr = this.item(i).getWallClearance();
                if(clr >= basicSeparation) {
                    score += 1;
                } else if (clr <= 0){
                    //score += 0;
                } else {
                    score += (clr/basicSeparation);
                }
            }

            score = score / this.context.count;

            // if(score < 0 || score > 1 || Number.isNaN(score)) {
            //     throw 'Unexpected edges score';
            // }

            return score;
        }

        getCentroidScore() {
            let m = 0, n = 0;
            for(let i = 0; i < this.context.count; i++) {
                let item = this.item(i);
                m += Math.abs(item.angle - this.context.mid);
                n += item.bubble().radius();
            }

            let avg = m/n;
            let score = avg / (this.context.sweep);
            score = 1.0 - score;

            // if(score < 0 || score > 1 || Number.isNaN(score)) {
            //     throw 'Unexpected centoid score';
            // }

            return score;
        }
    }

    class ArrangedItem {
        constructor(parent, idx, angle) {
            this.parent = parent;
            this.idx = idx;
            this.angle = angle;
        }

        bubble() {
            return this.parent.context.bubbles[this.idx];
        }

        position() {
            let r = this.bubble().fromCentre();
            let theta = this.angle;

            return [
                (r * Math.cos(theta)),
                (r * Math.sin(theta))
            ];
        }

        distanceTo(item) {
            let r = this.bubble().fromCentre();
            let theta = this.angle;

            let x1 = (r * Math.cos(theta));
            let y1 = (r * Math.sin(theta));

            r = item.bubble().fromCentre();
            theta = item.angle;

            let x2 = (r * Math.cos(theta));
            let y2 = (r * Math.sin(theta));

            let x = x2 - x1;
            let y = y2 - y1;

            return Math.sqrt(x*x + y*y);
        }

        isSimilarTo(item) {
            let a = this.bubble(), b = item.bubble();
            if(a.fork === b.code || b.fork === a.code) {
                return true;
            }

            if(a.similar[b.code] || b.similar[a.code]) {
                return true;
            }

            return false;
        }

        getWallClearance() {
            let clearanceAngle;
            if(this.angle > this.parent.context.mid) {
                clearanceAngle = this.parent.context.end - this.angle;
            } else {
                clearanceAngle = this.angle - this.parent.context.start;
            }

            let bubble = this.bubble();
            let radius = bubble.fromCentre();

            let angularSweep = (clearanceAngle / fullCircle) * (fullCircle * radius);
            return angularSweep - bubble.radius();
        }
    }

    function toScreenSpace(vect, midPoint)
    {
        return [
            vect[0] + midPoint[0],
            midPoint[1] - vect[1]
        ];
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

    function drawTitleAndLegends(data)
    {
        // Draw the categories overlay
        svg.append('image')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', width)
            .attr('height', height)
            .attr('href', 'assets/category-overlay.png');

        let y = margin;
        let x = width - margin;

        // Draw the main title
        svg.append('text')
            .text(`${data.length} Notable Cryptocurrencies`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'main-title');

        y += 40;

        // Draw the by line
        svg.append('text')
            .text(`A visualization by nickwb`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'by-line');        

        y += 100;
        
        // Draw the Top 5 by Market Cap
        svg.append('text')
            .text(`Top ${topN} by Market Capitalization`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'top-5-heading');

        y += 30;

        let byCap = data._orderBy(sorter.cap);
        for(let i = 1; i <= topN; i++) {
            let c = byCap[byCap.length - i];
            drawTopItem(c, x, y, 'cap');
            y+= 25;
        }

        y+= 80;

        // Draw the Top 5 by Trade Volume
        svg.append('text')
            .text(`Top ${topN} by 30 Day Trade Volume`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'top-5-heading');

        y += 30;

        let byVol = data._orderBy(sorter.vol);
        for(let i = 1; i <= topN; i++) {
            let c = byVol[byCap.length - i];
            drawTopItem(c, x, y, 'vol');
            y+= 25;
        }

        y+= 80;

        // Draw the 'key' bubble
        drawKey(x, y);

        // Bottom of the graphic..
        y = height - margin;

        // Draw the cite line
        svg.append('text')
            .text(`Data sourced from coinmarketcap.com`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'cite-line');

        // Left of the graphic
        x = margin;

        // Draw the github link
        svg.append('text')
            .text('github.com/nickwb/cryptographic')
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'github-line');

        // Top of the graphic
        y = margin;

        // Draw the github link
        svg.append('text')
            .text(when)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'date-line');
    }

    function drawTopItem(currency, x, y, type)
    {
        let fmt = d3.format(',');

        svg.append('text')
            .text(`${humaniseNumber(currency[type])}`)
            .attr('x', x)
            .attr('y', y)
            .attr('class', 'top-5-item item-val');

        svg.append('text')
            .text(`USD`)
            .attr('x', x - 80)
            .attr('y', y)
            .attr('class', `top-5-item item-usd-${type}`);

        svg.append('text')
            .text(`${currency.name}:`)
            .attr('x', x - 130)
            .attr('y', y)
            .attr('class', 'top-5-item item-name');
    }

    function drawKey(x, y)
    {
        // Define the dummy bubble
        let key = new Currency({ Code: 'CODE', Name: 'Name' });
        key.capScore = 0.5;
        key.volScore = 0.7;
        key.overall = 0.8;

        let radius = key.radius();
        let bubbleX = x - radius - 80;

        // Draw the 'Key' text
        svg.append('text')
            .text(`Key`)
            .attr('x', bubbleX)
            .attr('y', y)
            .attr('class', 'key-title');

        y += radius + 10;

        // Draw the bubble
        drawBubble(key, bubbleX, y);

        y += radius + 15;

        // Draw the annotations
        svg.append('text')
            .text(`Relative market capitalization`)
            .attr('x', bubbleX)
            .attr('y', y)
            .attr('class', 'key-cap');

        y += 20;

        svg.append('text')
            .text(`Relative trade volume (30 days)`)
            .attr('x', bubbleX)
            .attr('y', y)
            .attr('class', 'key-vol');

        y += 40;

        // Draw the log scale note
        svg.append('text')
            .text('Relative metrics use a log scale.')
            .attr('x', bubbleX)
            .attr('y', y)
            .attr('class', 'key-log');
    }

    function humaniseNumber(val) {
        let factor = [1000000000000, 1000000000, 1000000, 1000];
        let suffix = ['trillion', 'billion', 'million', 'thousand'];

        for(let i = 0; i < factor.length; i++) {
            let f = factor[i];
            if(val >= f) {
                return `${Math.round(val / f)} ${suffix[i]}`;
            }
        }

        return val;
    }

    d3.csv('data.csv', row => new Currency(row)).then(data => {
        enrichData(data);
        console.log(data);
        drawGraphic(data);
    });


})(window.d3);