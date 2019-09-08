//console.log = function(){}
var vesselName;

function getVesselName(){
  (async() => {
    try {
      var response = await fetch("/signalk/v1/api/vessels/self/name");
      vesselName = await response.json();
      return vesselName
    } catch (e) {
      console.log("Error fetching boat name")
    }
  })()
  return vesselName
}
getVesselName();


function switchPolar(p) {
    var chart = $('#container3').highcharts(),
    options = chart.options;
    options.chart.polar = p;
    if(p)
    {
        document.getElementById("toggle").innerHTML = "Line";
        chart.options.yAxis[1].reversed = true;
        //chart.options.plotOptions.histogram.stacking = 'percent';
    }
    else
    {
        document.getElementById("toggle").innerHTML = "Polar";
	chart.options.yAxis[1].reversed=false;
        //chart.options.plotOptions.histogram.stacking = 'normal';
        //chart.series[7].setData([],true,true,false);
    }

    saveCookies();
//    options.legend.layout.vertical= options.legend.layout.horizontal;
    $('#container3').highcharts(options);
}

var polarInited = false;
//to be updated once every second?:
var current = [];
//updated only on refresh:
var polarWind=[1,2,3,4,5,6];
var tackAngle;
var reachAngle;


var windSpeed = 5;
var windRange = 0.2 / 1.9438;

var nightmode = false;
var sowBucketSize=0.1;
var boatSpeedQue=[];
var boatSpeedQueMax = 10;
var updateCountsow=0;
var sowHistogram=Array.from(Array((10/sowBucketSize)), () => 0);

var sowTime = [];
var timeScatterLength = 100;
var sowAverageTime = []

console.log(sowHistogram);

$(function () {
 
 

  Highcharts.setOptions({
    global : {
      useUTC : false
    },
  });
  
  var screenWidth = window.innerWidth;
//  console.log("screen width: " + screenWidth);
  var screenHeight = window.innerHeight;
//  console.log("screen height: " + screenHeight);


  var graphTitle = document.getElementById('statusText');
  $('#container3').highcharts({

    chart: {
      animation: false,//to remove flickering on axis labels
      //borderWidth: 2,
      marginLeft: 50,
      //marginTop: 100,
     // polar: initPolar,
      events: {
          load: function () {
          var chart = $('#container3').highcharts();
          var plotLine = this.xAxis.plotLines;

         chart.setTitle({
	     align: 'left',
             text:''
	 });
	if (!polarInited)
	{
	
	  setInterval(function (){
		(async() => {
		time = new Date();
		a = time.getTime()
		var sowResponse = await fetch("/signalk/v1/api/vessels/self/navigation/speedThroughWater");
                var y = await sowResponse.json();
                y = JSON.stringify(y.value)
                y = parseFloat(y);
		sowTime.push([a,y*1.94384]);

		if (sowTime.length > timeScatterLength){
			sowTime.shift()
		};
		chart.series[2].setData(sowTime,true,false,false);
		function avgSow(sowTime) {
                        var total = 0;
                        for (i = sowTime.length - 10; i < sowTime.length; i ++) {
                                total += sowTime[i][1];
                        }
                        return total / 10;
                }
                averageSow = avgSow(sowTime)
		sowAverageTime.push([a,averageSow]);
		if (sowAverageTime.length > timeScatterLength){
                        sowAverageTime.shift()
                }
                console.log(sowAverageTime)
		chart.series[3].setData(sowAverageTime,true,false,false);
		})();
		},1000);

          // set up the updating of the plotlines each second
	  setInterval(function (){
	  (async() => { 
		try {
               // var response = await fetch("/signalk/v1/aipi/vessels/self/performance/beatAngle");
                var response = await fetch("/signalk/v1/api/vessels/self/navigation/speedThroughWater");
                var d = await response.json();
                d = JSON.stringify(d.value)
                d=parseFloat(d);
		bucketIndex = Math.round(d*1.94384/sowBucketSize);
                sowHistogram[bucketIndex]++;
                console.log(sowHistogram);
                boatSpeedQue.unshift(bucketIndex);
		console.log(boatSpeedQue);
                updateCountsow++;
                if (boatSpeedQue.length > boatSpeedQueMax){
                finPos=boatSpeedQue[boatSpeedQue.length-1];
                console.log(finPos);
                sowHistogram[finPos]--;
                boatSpeedQue.pop(boatSpeedQue.length- 1);
                }
                if (updateCountsow%1==0){
                        chart.series[1].setData(sowHistogram,false, false, false);
                        chart.series[0].setData(sowHistogram,true, false, false);
                }
                //console.log(boatSpeedQue);
                console.log(updateCountsow);
              //  response = await fetch("/signalk/v1/api/vessels/self/performance/gybeAngle");
              //  var y = await JSON.stringify(response.json().value);
              //  y = JSON.stringify(y.value);
              //  reachAngle = (y/Math.PI*180);

              }catch (e) {
                console.log("Error updating wind angle histogram")
              }
	  })(); 
	  },1000);
          setInterval(function () {

            chart = $('#container3').highcharts();
            (async() => {

              chart.xAxis[0].removePlotLine('tack');
              chart.xAxis[0].addPlotLine({
                color: '#FF0000', // Color value
                dashStyle: 'shortdashdot', // Style of the plot line. Default to solid
                value: tackAngle/Math.PI*180,//getTarget().Tack, // Value of where the line will appear
                width: 2, // Width of the line
                id: 'tack',
              });
	      chart.xAxis[0].removePlotLine('awa');
              chart.xAxis[0].addPlotLine({
                color: 'blue', // Color value
                dashStyle: 'shortdash', // Style of the plot line. Default to solid
                value: avgAwa/Math.PI*180,//getTarget().Tack, // Value of where the line will appear
                width: 2, // Width of the line
                id: 'awa',
              });
            })();
          }, 1000);
          // set up the updating of the chart each second


	  
	}

        }
      }

    },

    legend: {
    },

    pane: {
      center: ["50%", "50%"],
      startAngle: 0,
      endAngle: 360
    },

    xAxis:[{
      min:0,
      max:10,
      visible: true,
      opposite: true,
       },{
	visible: false,
	type: 'dateTime',
       }],

    yAxis: [{
       visible: false,
    },{
       endOnTick: false,
       visible: true,
       opposite: true,
       max: 10,
       min: 0,
    }],

    plotOptions: {
      series: {
        pointStart: 0,
	pointInterval: 10/sowHistogram.length,
        enableMouseTracking: false,
      },
      histogram:{
	stacking: 'normal' //(initPolar ? 'percent' : 'normal'),
      },
      column: {
        pointPadding: 0,
        groupPadding: 0
      },
      spline: { /* or line, area, series, areaspline etc.*/
        marker: {
          enabled: false
        },
        connectNulls: false
      },
      scatter: {
        dataLabels: {
          enabled: false,
          format: '{y:.2f}kn , {x:.1f}°'
        },
        marker: {
          //fillColor: 'transparent',
          lineWidth: 2,
          symbol: 'circle',
          lineColor: null
        }
      }
    },
   	  
    series: [
    {
      name: ' ',//'Histogram',
      type: 'histogram',
      color: 'rgba(255, 255, 255, 0)',
    },{
      name: 'sow histogram',
      type: 'histogram',
      color: 'red',
    },{
      name: 'sowTime',
      type: 'line',
      color: 'black',
      yAxis: 1,
      xAxis: 1,
      data: []
    },{
      name: 'sowAverageTime',
      type: 'line',
      color: 'blue',
      yAxis: 1,
      xAxis: 1,
      data: []
    }]
   
   
   	  
  });


   var addEvent= function(object, type, callback) {
    if (object == null || typeof(object) == 'undefined') return;
    if (object.addEventListener) {
        object.addEventListener(type, callback, false);
    } else if (object.attachEvent) {
        object.attachEvent("on" + type, callback);
    } else {
        object["on"+type] = callback;
    }

  }
  
  addEvent($('#container3'), "resize", function(event) {
   // console.log('resized');
      var chart = $('#container3').highcharts();
      chart.setSize(
              $(container).width(),
              $(container).height(),
              false
        );
      chart.height="200%";
  });
 	  
  

});




