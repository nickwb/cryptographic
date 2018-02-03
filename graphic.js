(function(d3){

    // Canvas size
    let width = 1200, height = 900;

    // Mid-point of the canvas
    let midX = width / 2, midY = height / 2;

    // Currency bubble sizes
    let minBubble = 15, maxBubble = 50;
    let minFont = 10, maxFont = 20;

    // Year ring radius
    let minRing = maxBubble*2, maxRing = (Math.min(width, height) / 2) - (maxBubble / 2);

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
        if(a.code === b.code) {
            return 0;
        }

        if(a.category !== b.category) {
            return a.category < b.category ? -1 : 1;
        }

        let ageSort = (a.year < b.year) ? -1 : 1;
        return ageSort;
    }

    let formatNumber = d3.format(',.0f');

    function enrichData(data)
    {
        // Sort currencies by category and age
        data.sort(sortCurrencies);
        
        // Total Market Cap and 30 Day Volume
        let allCap = d3.sum(data, x => x.cap);
        let allVol = d3.sum(data, x => x.vol);

        // Calculate the percentage of the total cap, and total volume
        data.forEach(x => {
            x.capPercent = (x.cap / allCap);
            x.volPercent = (x.vol / allVol);
            // Calculate "activity" as a 2:1 ratio of cap:vol
            x.activity = (2 * x.capPercent) + x.volPercent;
        });

        // Re-map the activity using a log scale
        let activityScale = d3.scaleLog()
            .base(1.1)
            .domain([d3.min(data, x => x.activity), d3.max(data, x => x.activity)])
            .range([0, 1]);

        data.forEach(x => {
            x.activity = activityScale(x.activity);
        });
    }

    let btc = null;
    let yearScale = null;
    let bubbleScale = null;
    let textScale = null;

    function drawGraphic(data)
    {
        btc = data.find(x => x.code === 'BTC');

        let years = [...new Set(data.filter(x => x.code !== btc.code).map(x => x.year))];
        years.sort();

        // Map the year to a ring radius
        yearScale = d3.scaleLinear()
            .domain([years[0], years[years.length - 1]])
            .range([minRing, maxRing]);

        years.forEach(y => {
            svg.append('circle')
               .attr('cx', midX)
               .attr('cy', midY)
               .attr('r', yearScale(y))
               .attr('class', 'year-ring');
        });
        
        // Map the activity to a bubble size
        bubbleScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minBubble, maxBubble]);

        // Map the activity to text size
        textScale = d3.scaleLinear()
            .domain([0, 1])
            .range([minFont, maxFont]);

        // Divide the total circle 
        let perBubble = (2 * Math.PI) / data.length;
        let angle = 0;

        data.forEach(c => {
            drawBubble(c, angle);
            angle += perBubble;
        });
    }

    function drawBubble(currency, angle)
    {
        let yearRadius = yearScale(currency.year);
        
        let bubbleX = midX + yearRadius * Math.cos(angle),
            bubbleY = midY + yearRadius * Math.sin(angle);

        if(currency.code === btc.code) {
            bubbleX = midX;
            bubbleY = midY;
        }

        let bubbleRadius = bubbleScale(currency.activity);

        let bubble = svg.append('circle')
            .attr('cx', bubbleX)
            .attr('cy', bubbleY)
            .attr('r', bubbleRadius)
            .attr('class', 'currency');
        
        let fontSize = textScale(currency.activity);

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
                .style('font-size', fontSize * 0.9)
                .attr('class', 'c-name');

            if(nameParts.length > 1) {
                let name2 = svg.append('text')
                .text(nameParts[1])
                .attr('x', bubbleX)
                .attr('y', lineLayout(2))
                .style('font-size', fontSize * 0.9)
                .attr('class', 'c-name');
            }
        }
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