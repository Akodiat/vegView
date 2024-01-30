class VegaPlotter {
    constructor(patches) {
        // Flatten data to a list of datapoints
        this.data = [];
        for (const patch of patches.values()) {
            for (const cohort of patch.cohorts.values()) {
                this.data.push(...cohort.timeSteps.values());
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
            mark: 'line',
            encoding: {
                y: {
                    aggregate: aggregate,
                    field: yField,
                    type: 'quantitative'
                },
                x: {
                    field: 'Year',
                    type: 'nominal',
                    axis: {
                        title: ""
                    }
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
        };

        // Embed the visualization in the container with id `plot`
        vegaEmbed('#plot', vlSpec);
    }
}

export {VegaPlotter}
