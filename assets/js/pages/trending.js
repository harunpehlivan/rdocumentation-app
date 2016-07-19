trendingPackagesLastWeek = function(){
	var getData = function(data_url, callback) {
    return $.get(data_url, callback);
  };

  nv.addGraph(function() {
  	var chart = nv.models.multiBarChart()
        .reduceXTicks(true)   //If 'false', every single x-axis tick label will be rendered.
        .rotateLabels(0)      //Angle to rotate x-axis labels.
        .groupSpacing(0.1)    //Distance between each group of bars.
        .stacked(true)
        .showControls(false)
        .x(function (d){
          return d.timestamp;
        })
        .y(function (d){
          return d.count;
        })
      ;

      chart.xAxis
          .tickFormat(function(d) { return d3.time.format('%x')(new Date(d)); });

      chart.yAxis
          .tickFormat(d3.format(',.1f'));

      getData($('#trendingdownloads').data('url'), function(data) {
      	var dict = {};
      	var days = [];
        data.forEach(function(day,i){
        	var buckets = day.day.buckets;
        	var time = day.key;
        	days.push(time);
        	buckets.forEach(function(bucket){
        		var key = bucket.key;
        		var array = dict[key.toString()]||[];
        		array.push({
        			count : bucket.doc_count,
        			key   : bucket.key,
        			timestamp : time
        		});
        		dict[key.toString()] = array;
        	})
        });
        console.log(days.length);
        for(var key in dict){
        	if(dict[key.toString()].length!=days.length){
        		days.forEach(function(day){
        			var found = false;
        			var i = 0;
        			while(!found&&i<dict[key.toString()].length){
        				if(dict[key.toString()][i].timestamp==day){
        					found = true;
        				}
        				i++;
        			}
        			if(!found){
        				dict[key.toString()].splice(days.indexOf(day),0,{
        					count : -1,
        					key   : key.toString(),
        					timestamp : day
        				});
        			}

        		});
        	}
        }
        var series =[];
        for(var key in dict){
        	series.push({
        		key: key,
        		values: dict[key.toString()]
        	})
        }
        $('#trendingdownloads').show();
        d3.select('#trendingdownloads svg')
          .datum(series)
          .call(chart);
      });

		chart.multibar.dispatch.on("elementClick", function(e) {
		    var url = "/packages/"+e.data.key;
		    document.location = url;
		});


      nv.utils.windowResize(chart.update);

      return chart;
});
}
trendingKeywords = function(){
	var getData = function(data_url, callback) {
    return $.get(data_url, callback);
  };

  nv.addGraph(function() {
  	var chart = nv.models.discreteBarChart()
        .x(function (d){
          return d["key"];
        })
        .y(function (d){
          return d.doc_count;
        })
        .staggerLabels(true)
        .color(['#33aacc'])
      ;

      getData($('#topkeywords').data('url'), function(data) {
      	console.log(data);
        $('#topkeywords').show();
        d3.select('#topkeywords svg')
          .datum([{
          	key: "Top keywords",
          	values: data
          }])
          .call(chart);
      });

      chart.discretebar.dispatch.on("elementClick", function(e) {
		    var url = "/search?q="+e.data.key;
		    document.location = url;
		});

      nv.utils.windowResize(chart.update);

      return chart;
});
}
dependencyGraph = function(){
	var getData = function(data_url, callback) {
    return $.get(data_url, callback);
  };
	nv.addGraph({
        generate: function() {
            var width = nv.utils.windowSize().width - 40,
                height = nv.utils.windowSize().height - 40;
            var d3Colors = d3.scale.category20();
            var chart = nv.models.forceDirectedGraph()
                .width(width)
                .height(height)
                .margin({top: 20, right: 20, bottom: 20, left: 20})
                .color(function(d) { return d3Colors(d.group) })
                .nodeExtras(function(node) {
                  node
                    .append("text")
                    .attr("dx", 12)
                    .attr("dy", ".35em")
                    .text(function(d) { return d.name });
                });
            chart.dispatch.on('renderEnd', function(){
                console.log('render complete');
            });
             getData($('#dependencygraph').data('url'), function(data) {
      	console.log(data);
        $('#dependencygraph').show();
        console.log(data);
        d3.select('#dependencygraph svg')
              .datum(data)
              .call(chart);
      });
            
            return chart;
    },
        callback: function(graph) {
            window.onresize = function() {
                var width = nv.utils.windowSize().width - 40,
                    height = nv.utils.windowSize().height - 40,
                    margin = graph.margin();
                if (width < margin.left + margin.right + 20)
                    width = margin.left + margin.right + 20;
                if (height < margin.top + margin.bottom + 20)
                    height = margin.top + margin.bottom + 20;
                graph.width(width).height(height);
                d3.select('#dependencygraph svg')
                    .attr('width', width)
                    .attr('height', height)
                    .call(graph);
            };
        }
    });
}

$(document).ready(function(){
	trendingPackagesLastWeek();
	trendingKeywords();
	dependencyGraph();
});