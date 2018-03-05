# cryptographic
A cryptocurrency visualization. **[Click here to view.](https://i.imgur.com/YGwn9n9.png)**


## Introduction
It's an exciting time for cryptocurrency. As of March 2018, there are more than a thousand currencies in existence, with a combined [market capitalization](https://en.wikipedia.org/wiki/Market_capitalization) of over **USD $460 billion**.

For comparison, this is a little more than half the size of *Apple Inc.*, the largest publicly-traded company in the world, valued by markets according to its $375 billion in assets and $230 billion in annual revenues in 2017.

Just one year ago, this combined crypto market capitalization was less than $19 billion. Two years ago it was less than $8 billion. A lot of apparent wealth has been created in a very short space of time.

The preeminent and original cryptocurrency, Bitcoin, has grown by ~2200% in that two year period. The remaining growth (~2700%) has come from the alternative currencies (altcoins), which now account for around 60% of the total market.

This visualization shows just 25 of these cryptocurrencies. It's a sample which shows all of the major currencies, plus some others of historical or technological significance. The 25 selected account for over 90% of the total market capitalization, and over 85% of the total trade volume.

The aim of this visualization is to tell a story of the evolution of cryptocurrency. It shows the different directions the technology has gone, and which currencies have grown to be dominant in this emerging landscape.

Data for this visualization has been sourced from the excellent: [coinmarketcap.com](https://coinmarketcap.com/).


## Technology
This is a *Pie + Radar + Gauge Chart* written in JavaScript using **d3.js** and **SVG**.

This entire visualization is data driven. You can modify `data.csv` and the graphic will update accordingly. The one exception are the section labels which appear on each pie piece; these have been hand-positioned and are drawn from a static overlay file that you can find under `assets/`.

## Running

Just serve up the static files in this repository from a web server; then load it with a web browser.

For example:

```bash
$ npm install -g http-server
$ http-server .
# Open a browser to localhost:8080
```

It will take a little time to run, around 15 seconds on my current hardware. The visualization performs an exhaustive search when selecting a layout for the currencies. It will lock up the UI of the tab during that time, and you may be prompted to kill it - just persevere.

# Requirements
This visualization requires a somewhat modern browser to run. It uses some semi-recent JavaScript features, such as Maps, Sets, Generators and Arrow Functions.

It has been tested primarily in Chrome 64.0, and the official render was captured on Windows 10 using this browser. It does render on Firefox 58.0, though text rendering seems to be incorrect (no support for `alignment-baseline`?).

# License and Attribution
This source code, and the official render of the visualization are dedicated to the public domain. See [UNLICENSE](https://github.com/nickwb/cryptographic/blob/master/UNLICENSE) for more information.

You are welcome to publish the visualization in any form, you do not need to seek my permission. Remixes are both welcomed and encouraged. If you do publish or remix the visualization, get in touch, I'd love to hear from you.

If you would like to attribute this visualization to the original author, you are welcome to do so. I am `Nick Young; https://github.com/nickwb`.

The data underlying this visualization is copyright [coinmarketcap.com](https://coinmarketcap.com/).

