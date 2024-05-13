import React from 'react';
import PropTypes from 'prop-types';
import {
    AreaChart,
    Card,
    CardBody,
    HeadingText,
    NrqlQuery,
    PlatformStateContext,
    LineChart
} from 'nr1';
import {transformData} from './transform';

export default class GranularChartVisualization extends React.Component {
    // Custom props you wish to be configurable in the UI must also be defined in
    // the nr1.json file for the visualization. See docs for more details.
    static propTypes = {
        /**
         * Account Id against which the query needs to be executed.
         */
        accountId: PropTypes.number,

        /**
         * NRQL query for main table
         */
        nrqlQuery: PropTypes.string,

        /**
         * Choose chart type
         */
        areaChart: PropTypes.bool,

        /**
         * Choose number of queries, more increases buckets
         */
        threeQueries: PropTypes.bool,
    }

    constructor(props) {
        super(props);
        this.state = {
            data: [],
            interval: 60000,
            intervalId: null,
            selectedItem: null,
        };
        this.run = () => this.runQueries();
        this.set = (context) => this.setTimeInterval(context);
    }

    /**
     * Call runQueries when time-picker changes
     */
    componentDidMount() {
        this.firstTime = true;
        PlatformStateContext.subscribe(this.set);
    }

    /**
     * Set the time range and refresh interval
     */
    setTimeInterval(context) {
        // Skip first call to avoid repeat when component mounts
        if (this.firstTime) {
            this.firstTime = false;
            return
        }
        // Calculate duration
        let duration;
        if (context.timeRange) {
            if (context.timeRange.duration) {
                if (this.timeRange && context.timeRange.duration === this.timeRange.duration) {
                    // nothing changed, exit
                    return;
                }
                duration = context.timeRange.duration;
            } else if (context.timeRange.begin_time && context.timeRange.end_time) {
                if (this.timeRange && context.timeRange.begin_time === this.timeRange.begin_time &&
                    context.timeRange.end_time === this.timeRange.end_time) {
                    // nothing changed, exit
                    return;
                }
                duration = context.timeRange.end_time - context.timeRange.begin_time;
            } else {
                duration = 3600000;
            }
            this.timeRange = context.timeRange;
        } else {
            this.timeRange = {};
            duration = 3600000;
        }
        // Set refresh interval to 1/60 of duration, or at least 1 minute
        let interval = Math.round(duration/60);
        if (interval < 60000) {
            interval = 60000;
        }
        // Update refresh as needed
        if (!this.intervalId) {
            this.intervalId = setInterval(this.run, interval);
            this.interval = interval;
        } else if (this.interval !== interval) {
            clearInterval(this.state.intervalId);
            this.intervalId = setInterval(this.run, interval);
            this.interval = interval;
        }
        // Run queries
        this.runQueries();
    }

    /**
     * Run Nrql queries, append together, and set state with results
     */
    runQueries() {
        const {accountId, nrqlQuery, threeQueries} = this.props;
        if (!accountId) {
            console.log('AccountId not configured');
            return
        }
        if (!nrqlQuery) {
            console.log('NRQL query not configured');
            return
        }
        // Calculate time range
        let duration, begin_time, end_time;
        const now = Date.now();
        if (this.timeRange.duration) {
            duration = this.timeRange.duration;
            begin_time = now - this.timeRange.duration;
            end_time = now;
        } else if (this.timeRange.begin_time && this.timeRange.end_time) {
            duration = this.timeRange.end_time - this.timeRange.begin_time;
            begin_time = this.timeRange.begin_time;
            end_time = this.timeRange.end_time;
        } else {
            // No duration means default to 1 hour
            duration = 3600000;
            begin_time = now - duration;
            end_time = now;
        }

        // Generate queries in promise array
        const count = threeQueries ? 3 : 2;
        const step = Math.round(duration / count);
        const accountIds = [accountId];
        let promiseArr = [];
        let query;
        let current = begin_time;
        for (let i = 1; i < count; i++) {
            query = nrqlQuery + ' SINCE ' + current.toString() + ' UNTIL ' + (current + step).toString();
            //console.log('query:', query);
            promiseArr.push(NrqlQuery.query({query, accountIds}));
            current += step;
        }
        query = nrqlQuery + ' SINCE ' + current.toString() + ' UNTIL ' + end_time.toString();
        //console.log('query:', query);
        promiseArr.push(NrqlQuery.query({query, accountIds}));
        // Execute queries
        Promise.all(promiseArr).then((results)=>{
            // Start with the first query result
            let data = results[0].data;
            let last = data.length;
            let lookup = {};
            // Update metadata timestamp with ultimate begin_time
            for (let j = 0; j<data.length; j++) {
                data[j].metadata.timeRange.end_time = end_time;
                lookup[data[j].metadata.name] = j;
            }
            // Append additional queries
            for (let i=1; i< results.length; i++) {
                const result = results[i].data;
                // Append each facet
                for (let j = 0; j<result.length; j++) {
                    const name = result[j].metadata.name;
                    const idx = lookup[name];
                    if (idx) {
                        // facet matches first query, use lookup index
                        data[idx].data.push(...result[j].data)
                    } else {
                        // new facet, store index in lookup and append to data
                        lookup[name] = last;
                        last++;
                        result[j].metadata.timeRange.end_time = end_time;
                        data.push(result[j]);
                    }
                }
            }
            // Refresh the chart
            //console.log('data:', data)
            this.setState({data});
        });
    }

    render() {
        const {accountId, areaChart, nrqlQuery} = this.props;
        const {data} = this.state;
        const nrqlQueryPropsAvailable = accountId && nrqlQuery;
        if (!nrqlQueryPropsAvailable) {
            return <EmptyState message="Please configure the following"/>;
        }
        if (!nrqlQuery.toLowerCase().includes('timeseries')) {
            return <EmptyState message="Only TIMESERIES NRQL Query supported"/>;
        }
        if (areaChart) {
            return <AreaChart data={data} fullHeight fullWidth/>;
        } else {
            return <LineChart data={data} fullHeight fullWidth/>;
        }
    }
}

const EmptyState = (props) => (
    <Card className="EmptyState">
        <CardBody className="EmptyState-cardBody">
            <HeadingText
                spacingType={[HeadingText.SPACING_TYPE.LARGE]}
                type={HeadingText.TYPE.HEADING_3}
            >
                {props.message}:
            </HeadingText>
            <p>
                Select an account ID and a NRQL query<br/>
                Choose Line chart (default) or Area chart (enable the option)<br/>
                Also choose 2 (default) or 3 queries (extra granular)
            </p>
            <HeadingText
                spacingType={[HeadingText.SPACING_TYPE.MEDIUM]}
                type={HeadingText.TYPE.HEADING_4}
            >
                Example NRQL TIMESERIES query:
            </HeadingText>
            <code>
                SELECT latest(cpuPercent) FROM ProcessSample FACET processDisplayName TIMESERIES
            </code>
            <p>Don't include a timerange in the query, as this needs to come from the timepicker.</p>
        </CardBody>
    </Card>
);

const ErrorState = (props) => (
    <Card className="ErrorState">
        <CardBody className="ErrorState-cardBody">
            <HeadingText
                className="ErrorState-headingText"
                spacingType={[HeadingText.SPACING_TYPE.LARGE]}
                type={HeadingText.TYPE.HEADING_3}
            >
                Oops! Something went wrong.<br/><br/>
                {props.message}
            </HeadingText>
        </CardBody>
    </Card>
);
