(function(d3){

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
        // Sort currencies by category and age
        data.sort(sortCurrencies);
        
        // Total Market Cap and 30 Day Volume
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
        // Giving a little bit of room for the year legend
        // and ignoring BTC because it's special
        let perBubble = ((2 * Math.PI) - yearClearance) / (data.length - 1);
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

        drawYears(years);

        // Map the overall score to a bubble size
        bubbleScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minBubble, maxBubble]);

        // Map the overall scope to text size
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
            .startAngle((Math.PI / 2) - cat.startAngle)
            .endAngle((Math.PI / 2) - cat.endAngle);

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
        let minAngle = cat.startAngle;
        let maxAngle = cat.startAngle + sweep;
        console.log(`${cat.category} min: ${minAngle} max: ${maxAngle} sweep: ${sweep}`);

        // Group the currencies in to years
        let catByYears = cat.reduce((memo, currency) => {
            memo[currency.year] = memo[currency.year] || [];
            memo[currency.year].push(currency);
            return memo;
        }, {});

        let catYears = Object.keys(catByYears);
        catYears.sort();

        let groupIndex = 0;

        catYears.forEach(y => {
            let stripe = groupIndex % 4;
            let extraMember = groupIndex % 2;

            let members = catByYears[y];
            let division = sweep / (members.length + extraMember);
            let angle = minAngle;

            if(stripe == 1) { angle += division; }

            members.forEach(currency => {
                drawBubble(currency, (angle + 0.5*division) * -1);
                angle += division;
            });

            if(stripe == 3) { angle += division; }

            groupIndex++;
        });
    }

    function drawBubble(currency, angle)
    {
        let yearRadius = yearScale(currency.year);
        
        let bubbleX = midX + (yearRadius * Math.cos(angle)),
            bubbleY = midY + (yearRadius * Math.sin(angle));

        if(currency.code === btc.code) {
            bubbleX = midX;
            bubbleY = midY;
        }

        let bubbleRadius = bubbleScale(currency.overall);

        let background = svg.append('circle')
            .attr('cx', bubbleX)
            .attr('cy', bubbleY)
            .attr('r', bubbleRadius)
            .attr('class', 'c-background');

        drawScoreArc(bubbleX, bubbleY, bubbleRadius, currency.capScore, 'right', 'c-cap-arc');
        drawScoreArc(bubbleX, bubbleY, bubbleRadius, currency.volScore, 'left', 'c-vol-arc');

        let outline = svg.append('circle')
            .attr('cx', bubbleX)
            .attr('cy', bubbleY)
            .attr('r', bubbleRadius)
            .attr('class', 'c-outline');
        
        let fontSize = textScale(currency.overall);

        let textLayout = d3.scaleLinear()
                            .domain([0, 1])
                            .range([bubbleY - bubbleRadius, bubbleY + bubbleRadius]);

        let nameParts = currency.name.split(' ');
        let noName = (currency.code === currency.name.toUpperCase() || bubbleRadius < 18);
        let lineCount = noName ? 1 : nameParts.length + 1;
        let lineLayout = (i) => textLayout(textLayoutMap[lineCount][i]);

        let code = svg.append('text')
            .text(currency.code)
            .attr('x', bubbleX)
            .attr('y', lineLayout(0))
            .style('font-size', fontSize)
            .attr('class', 'c-code');
        
        if(!noName) {
            let name1 = svg.append('text')
                .text(nameParts[0])
                .attr('x', bubbleX)
                .attr('y', lineLayout(1))
                .style('font-size', fontSize * 0.8)
                .attr('class', 'c-name');

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
        var arcLength = (Math.PI * score);

        arcLength = (direction == 'right') ? -arcLength : arcLength;

        let capArc = d3.arc()
            .innerRadius(0.85 * bubbleRadius)
            .outerRadius(bubbleRadius)
            .startAngle(Math.PI)
            .endAngle(Math.PI + arcLength);

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
        console.log(data);
        drawGraphic(data);
    });


})(window.d3);