class VegaPlotter {
    /**
     * Class for plotting with VegaLite
     * @param {*} patchManager
     * @param {*} onclick
     */
    constructor(patchManager, onclick) {
        this.onclick = onclick;
        this.patchManager = patchManager;
        // Flatten data to a list of datapoints
        this.data = [];
        for (const patch of patchManager.patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                for (const [year, data] of cohort.timeSteps.entries()) {
                    const d = {
                        ...data,
                        ...patchManager.yearData.get(year),
                        positions: undefined
                    };
                    // Convert to date
                    d.Date = new Date(d.Year, 0, 1);
                    this.data.push(d);
                }
            }
        }
    }

    /**
     * Plot cohort values over time
     * @param {*} yField Value to show on the y-axis
     * @param {*} aggregate Optional aggregation (average, median, max, min, or sum)
     * @param {*} colorField Value to use for grouping
     */
    timePlot(yField="Height", aggregate="average", colorField="PID") {
        // Assign the specification to a local variable vlSpec.
        const vlSpec = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: {
                values: this.data
            },
            width: "container", height: 150,
            encoding: {
                x: {
                    field: "Date",
                    type: "temporal",
                    axis: {
                        format: "%Y",
                        title: ""
                    }
                }
            },
            layer: [
                {
                    mark: "line",
                    encoding: {
                        y: {
                            aggregate: aggregate,
                            field: yField,
                            type: "quantitative"
                        },
                        color: {field: colorField, type: "nominal"},
                        tooltip: [
                            {aggregate: aggregate,
                                field: yField,
                                type: "quantitative",
                            },
                            {field: "Date",  type: "temporal", axis: {format: "%Y"}},
                            {field: colorField, type: "nominal"}
                        ],
                    }
                },
                {
                    params: [{
                        name: "index",
                        value: [{x: {year: Math.min(...this.patchManager.years)}}],
                        select: {
                            type: "point",
                            encodings: ["x"],
                            on: "click",
                            nearest: true
                        }
                    }],
                    mark: {type: "point"},
                    encoding: {
                        y: {field: yField, type: "quantitative"},
                        opacity: {value: 0}
                    }
                },
                {
                    transform: [{filter: {and: ["index.Date", {param: "index"}]}}],
                    mark: "rule",
                },
                {
                    transform: [{filter: {and: ["index.Date", {param: "index"}]}}],
                    mark: "text",
                    encoding: {
                        y: {"value": 10},
                        text: {field: "Date", type: "temporal", axis: {format: "%Y"}, fontSize: 30}
                    }
                }
            ],
            config: {text: {align: "right", dx: -5, dy: 5}}
        };

        // Embed the visualization in the container with id `plot`
        // eslint-disable-next-line no-undef
        vegaEmbed("#plot", vlSpec).then(result => {
            result.view.addEventListener("click", (event, item) => {
                this.onclick(item.datum.datum.Year);
            });
        });
    }
}

export {VegaPlotter};
