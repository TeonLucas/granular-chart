# granular-chart-app

Custom visualization for more granular TIMESERIES, using multiple queries.
Can be configured with 2 or 3 queries, for a potential of 732 or 1098 buckets.

## Getting started

Select which account you want to run this on:
```
nr1 profiles:default
```

Next update the nerdpack id for that account:
```
nr1 nerdpack:uuid -g
```
*Note:  Don't commit the nr1.json file to the repo, this contains your UUID.*

Install the node packages:
```
npm install
```

## Running the local version

Now you are ready to run:
```
npm start
```
Visit https://one.newrelic.com/?nerdpacks=local and :sparkles:

## Deploy the visualization

When you are ready to deploy to your account:
```
nr1 nerdpack:publish
nr1 nerdpack:subscribe
```

## Limitations

The two chart types are Area or Line chart.  The query must be a NRQL TIMESERIES.
