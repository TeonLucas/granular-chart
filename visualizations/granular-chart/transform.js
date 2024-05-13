/**
 * Convert the NRQL query results into sorted rows for the table
 */
export const transformData = (data, rows, columns, unitsData) => {
    // check for valid data
    if (!data || data.length === 0) {
        return
    }
    const metadata = data[0].metadata;
    if (metadata.groups.length === 0) {
        return
    }

    // NRQL query is simple series, no facets
    if (metadata.groups[0].name === "events" && metadata.groups[0].value === "series") {
        const series = data[0].data;
        getSeriesColumns(metadata, columns);
        rows.push(...series)
        unitsData.push(metadata.units_data);
        return
    }

    // NRQL query has functions and facets
    columns.push("timestamp");
    getFacetColumns(metadata, columns);
    let dataColumns = [];
    getDataColumns(metadata, dataColumns);
    for (let item of data) {
        let row = {};
        // gather facet columns
        for (let col of item.metadata.groups) {
            if (col.type === "facet") {
                row[col.name] = col.value;
            }
        }
        // gather data columns
        for (let i = 0; i < item.data.length; i++) {
            const key = dataColumns[i];
            row[key] = item.data[i][key];
        }
        // get timestamp
        row.timestamp = item.data[0].begin_time;
        rows.push(row);
    }
    columns.push(...dataColumns);
    unitsData.push({ "timestamp": "TIMESTAMP" });
};

/**
 * Extract data section, and metadata facets, to make rows and columns
 */
const getFacetColumns = (metadata, columns) => {
    for (let col of metadata.groups) {
        if (col.type === "facet") {
            columns.push(col.name)
        }
    }
};
const getDataColumns = (metadata, columns) => {
    for (let col of metadata.groups) {
        if (col.type !== "facet") {
            columns.push(col.displayName)
        }
    }
};
const getSeriesColumns = (metadata, columns) => {
    for (let key of Object.keys(metadata.units_data)) {
        if (key !== "x" && key !== "y") {
            columns.push(key);
        }
    }
};
