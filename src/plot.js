class VegaPlotter {
    constructor(cohorts) {
        // Flatten data to a list of datapoints
        this.data = [...cohorts.values()].flatMap(c=>[...c.timeSteps.values()])
    }

    plotPatchHeight() {
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
                    aggregate: 'average',
                    field: 'Height',
                    type: 'quantitative',
                    axis: {
                        title: 'Average tree height'
                    }
                },
                x: {
                    field: 'Year',
                    type: 'nominal',
                    axis: {
                        title: ""
                    }
                },
                color: {field: 'PID', type: 'nominal'},
                tooltip: [
                    {aggregate: 'average', field: 'Height', type: 'quantitative'},
                    {field: 'Year', type: 'quantitative'},
                    {field: 'PID', type: 'nominal'}
                ],
            }
        };

        // Embed the visualization in the container with id `plot`
        vegaEmbed('#plot', vlSpec);
    }
}

export {VegaPlotter}
