//console.log = function(){}
const tableData = {}
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
    var chart = $('#container').highcharts(),
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
    $('#container').highcharts(options);
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
var awaBucketDegree=1;
var windAngleQue=[];
var windAngleQueMax = 10;
var avgAwa = 0;
var updateCount=0;
var awaHistogram=Array.from(Array((360/awaBucketDegree)), () => 0);

var awaTime = [];
var timeScatterLength = 100;
var awaAverageTime = []

console.log(awaHistogram);

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
  $('#container').highcharts({

    chart: {
      animation: false,//to remove flickering on axis labels
      //borderWidth: 2,
      marginLeft: 50,
      //marginTop: 100,
     // polar: initPolar,
      events: {
          load: function () {
          var chart = $('#container').highcharts();
          var plotLine = this.xAxis.plotLines;

         chart.setTitle({
	     align: 'left',
             text:''
	 });
	if (!polarInited)
	{
	
	  setInterval(function (){
		(async() => {
		if(tackAngle > 180){
			tackAngle = tackAngle - 360;
		}
		time = new Date();
		a = time.getTime()
		awaTime.push([a,Math.abs(tackAngle)]);
		console.log(awaTime);
		
		if (awaTime.length > timeScatterLength){
			awaTime.shift()
		};
		chart.series[2].setData(awaTime,true,false,false);
		
		if (avgAwa > 180){
			avgAwa = avgAwa - 360
		}
		awaAverageTime.push([a,Math.abs(avgAwa)]);
		if (awaAverageTime.length > timeScatterLength){
                        awaAverageTime.shift()
                };
                console.log(awaAverageTime)
		chart.series[3].setData(awaAverageTime,true,false,false);
		})();
		},1000);

          // set up the updating of the plotlines each second
	  setInterval(function (){
	  (async() => { 
		try {
               // var response = await fetch("/signalk/v1/aipi/vessels/self/performance/beatAngle");
                var response = await fetch("/signalk/v1/api/vessels/self/environment/wind/angleApparent");
                var x = await response.json();
                x = JSON.stringify(x.value)
                tackAngle=parseFloat(x);
		tackAngle = Math.round(tackAngle/Math.PI*180);
		if(tackAngle < -180){
			tackAngle = tackAngle+360;
		}
		if(tackAngle < 0){
			tackAngle = tackAngle+360
		}
		console.log("tackAngle:",tackAngle);
		console.log('avgAwa: ',avgAwa);
                bucketIndex=Math.trunc(tackAngle/awaBucketDegree);
                awaHistogram[bucketIndex]++;
                console.log(awaHistogram);
                windAngleQue.unshift(bucketIndex);
		console.log(windAngleQue);
                updateCount++;
                if (windAngleQue.length > windAngleQueMax){
                finPos=windAngleQue[windAngleQue.length-1];
                console.log(finPos);
                awaHistogram[finPos]--;
                windAngleQue.pop(windAngleQue.length- 1);
                }
                if (updateCount%1==0){
                        chart.series[1].setData(awaHistogram,false, false, false);
                        chart.series[0].setData(awaHistogram,true, false, false);
			avgAwa = Math.atan2(
				windAngleQue.reduce(function(total, num){return total+Math.sin(num * awaBucketDegree/180*Math.PI)}, 0), 
				windAngleQue.reduce(function(total, num){return total+Math.cos(num * awaBucketDegree/180*Math.PI)}, 0))/Math.PI*180;
                }
                //console.log(windAngleQue);
                console.log(updateCount);
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

            chart = $('#container').highcharts();
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
      tickInterval: 45,
      min:0,
      max:360,
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
       tickInterval: 10,
       visible: true,
       opposite: true,
       max: 180,
       min: 0,
    }],

    plotOptions: {
      series: {
        pointStart: 0,
        pointInterval: 360/awaHistogram.length,
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
      name: 'awa histogram',
      type: 'histogram',
      color: 'red',
    },{
      name: 'awaTime',
      type: 'line',
      color: 'black',
      yAxis: 1,
      xAxis: 1,
      data: []
    },{
      name: 'awaAverageTime',
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
  
  addEvent($('#container'), "resize", function(event) {
   // console.log('resized');
      var chart = $('#container').highcharts();
      chart.setSize(
              $(container).width(),
              $(container).height(),
              false
        );
      chart.height="200%";
  });
 	  
  

});




