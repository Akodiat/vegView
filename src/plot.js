class VegaPlotter {
    constructor(patchManager, onclick) {
        this.onclick = onclick;
        // Flatten data to a list of datapoints
        this.data = [];
        for (const patch of patchManager.patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                for (const [year, data] of cohort.timeSteps.entries()) {
                    const d = {
                        ...data,
                        ...patchManager.yearData.get(year),
                        positions: undefined
                    }
                    this.data.push(d);
                }
            }
        }
    }

    timePlot(yField="Height", aggregate='average', colorField='PID') {
        // Assign the specification to a local variable vlSpec.
        const vlSpec = {
            $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
            data: {
                values: this.data
            },
            width: 'container', height: 150,
            encoding: {
                x: {
                    field: 'Year',
                    type: 'nominal',
                    axis: {
                        title: ""
                    }
                }
            },
            layer: [
            {
                mark: 'line',
                encoding: {
                    y: {
                        aggregate: aggregate,
                        field: yField,
                        type: 'quantitative'
                    },
                    color: {field: colorField, type: 'nominal'},
                    tooltip: [
                        {aggregate: aggregate,
                            field: yField,
                            type: 'quantitative',
                        },
                        {field: 'Year', type: 'quantitative'},
                        {field: colorField, type: 'nominal'}
                    ],
                }
            },
            {
                params: [{
                    name: "index",
                    select: {
                        type: "point",
                        encodings: ["x"],
                        on: "pointermove",
                        nearest: true
                    }
                }],
                mark: {type: "point"},
                encoding: {
                    y: {field: yField, type: 'quantitative'},
                    opacity: {value: 0}
                }
            },
            {
                transform: [{filter: {and: ["index.Year", {param: "index"}]}}],
                mark: "rule",
            },
            {
                transform: [{filter: {and: ["index.Year", {param: "index"}]}}],
                mark: "text",
                encoding: {
                  y: {"value": 10},
                  text: {field: "Year", type: "nominal", fontSize: 30}
                }
            }
            ],
            config: {text: {align: "right", dx: -5, dy: 5}}
        };

        // Embed the visualization in the container with id `plot`
        vegaEmbed('#plot', vlSpec).then(result => {
            result.view.addEventListener('click', (event, item) => {
                this.onclick(item.datum.datum.Year);
            });
        })
    }
}

export {VegaPlotter}
