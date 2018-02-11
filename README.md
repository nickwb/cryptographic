# cryptographic
A cryptocurrency visualization. **[Click here to view.](http://todo.com)**


## Introduction
It's an exciting time for cryptocurrency. As of February 2018, there are more than a thousand currencies in existence, with a combined [market capitalization](https://en.wikipedia.org/wiki/Market_capitalization) of over **USD $390 billion**.

For comparison, this is around half the size of *Apple Inc.*, the largest publicly-traded company in the world, valued by markets according to its $375 billion in assets and $230 billion in annual revenues.

Just one year ago, this combined crypto market capitalization was less than $19 billion. Two years ago it was less than $8 billion. A lot of apparent wealth has been created in a very short space of time.

The preeminent and original cryptocurrency, Bitcoin, has grown by ~2200% in that two year period. The remaining growth (~2700%) has come from the alternative currencies (altcoins), which now account for around two thirds of the total market.

This visualization shows just 25 of these cryptocurrencies. It's a sample which shows all of the major currencies, plus some others of historical or technological significance. The 25 selected account for over 90% of the total market capitalization, and over 85% of the total trade volume.

The aim of this visualization is to tell a story of the evolution of cryptocurrency. It shows the different directions the technology has gone, and how the various currencies are now valued relative to each other.

Data for this visualization has been sourced from the excellent: [coinmarketcap.com](https://coinmarketcap.com/).


## Technology
This is a *Pie + Radar + Gauge Chart* written in JavaScript with **d3.js** and **SVG**.

This entire visualization is data driven. You can modify `data.csv` and the graphic will update accordingly. The one exception are the section labels which appear on each pie piece; these have been hand-positioned and are drawn from a static overlay file that you can find under `assets/`.

## Rendering

Just serve up the static files in this repository from a web server; then load it with a web browser.

For example:

```bash
$ npm install -g http-server
$ http-server .
# Open a browser to localhost:8080
```