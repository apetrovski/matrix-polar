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
var stbPolar = [];
var polarWind=[1,2,3,4,5,6];
var stbPolar5 = [];
var stbPolar10 = [];
var stbPolar15 = [];
var stbPolar20 = [];
var stbPolar25 = [];
var stbPolar30 = [];
var polar1=[];
var tackAngle;
var reachAngle;

var layout = "horizontal";
var verticalAlign = "middle";
var align = "right";

var windSpeed = 5;
var windRange = 0.2 / 1.9438;

var nightmode = false;
var awaBucketDegree=1;
var windAngleQue=[];
var windAngleQueMax = 10;
var avgAwa = 0;
var updateCount=0;
var awaHistogram=Array.from(Array((360/awaBucketDegree)), () => 0);

console.log(awaHistogram);
function getWind() {
  (async() => {
    try {
      var response = await fetch("/signalk/v1/api/vessels/self/environment/wind/speedApparent");
      windSpeedTemp = await response.json();
      windSpeed = parseFloat(JSON.parse(windSpeedTemp.value))
     // console.log("wind speed: " + windSpeed*1.9438 )
    } catch (e) {
      console.log("Error fetching wind speed")
    }
  })()
  return windSpeed*1.9438;
};



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

  if(window.innerWidth > window.innerHeight)
  {
     layout = "vertical";
     verticalAlign = "middle";
     align = "right";
  }
  else
  {
     layout = "horizontal";
     verticalAlign = "bottom";
     align = "middle";
  }

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
		polarInited = true;
		loadCookies();
		var initPolar = document.getElementById("toggle").innerHTML == "Line";
		console.log("initPolar:" + initPolar);		
		switchPolar(initPolar);
	
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
                bucketIndex=Math.trunc(tackAngle/awaBucketDegree);
                awaHistogram[bucketIndex]++;
                windAngleQue.unshift(bucketIndex);
                updateCount++;
                if (windAngleQue.length > windAngleQueMax){
                finPos=windAngleQue[windAngleQue.length-1];
                awaHistogram[finPos]--;
                windAngleQue.pop(windAngleQue.length- 1);
                }
                if (updateCount%1==0){
                        chart.series[7].setData(awaHistogram,false, false, false);
                        chart.series[6].setData(awaHistogram,true, false, false);
			avgAwa = Math.atan2(
				windAngleQue.reduce(function(total, num){return total+Math.sin(num * awaBucketDegree/180*Math.PI)}, 0), 
				windAngleQue.reduce(function(total, num){return total+Math.cos(num * awaBucketDegree/180*Math.PI)}, 0))/Math.PI*180;
                }
                //console.log(windAngleQue);
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
                value: tackAngle,//getTarget().Tack, // Value of where the line will appear
                width: 2, // Width of the line
                id: 'tack',
              });
	      chart.xAxis[0].removePlotLine('awa');
              chart.xAxis[0].addPlotLine({
                color: 'blue', // Color value
                dashStyle: 'shortdash', // Style of the plot line. Default to solid
                value: avgAwa,//getTarget().Tack, // Value of where the line will appear
                width: 2, // Width of the line
                id: 'awa',
              });
            })();
          }, 1000);
          // set up the updating of the chart each second


          setInterval(function () {
	   // var windMinSlider = document.getElementById("myRange");
           //vesselName = getVesselName()
           var subTitle = vesselName + " Wind speed: "+ getWind().toFixed(2)+' +/- '+windRange.toFixed(1)+' kn';
	   // var subTitle ='blah'+ windMinSlider.value+'tada' ;
	  
           // (async() => {
              try {
                fetch("/signalk/v1/api/vessels/self/propulsion").then(
			function(response){return (response.json());}).then(
			function(myJson){
		          var engineOn = false;
			  for(var engine in myJson){
		              // console.log(myJson[engine].revolutions.value)
				if (myJson[engine].revolutions.value > 0){
					engineOn = true;
					break;
				}
			  }
			  if(engineOn){
                       		 subTitle = subTitle + " Motoring"
                          }else{
				 subTitle = subTitle + " Sailing" 
                          }
                          graphTitle.innerHTML =  subTitle;
		        //  console.log(graphTitle);

			});
		
              } catch (e) {
                console.log(e)
               };
           // });
	}, 1000);
           
  
	  //update current polar each second
	  
	    function test(windSpeed, seriesStart, stbPolar, polarWindIndex, chart){	
           //   setInterval(windMinSlider1(),1000);
	  //  setInterval(function  () {
              //var chart = $('#container').highcharts();
              options = chart.options;
              $.getJSON("/plugins/signalk-polar/polarTable/?windspeed=" + windSpeed  + "&interval=" + windRange, function (json) {
                stbPolar.length = 0;

                json.forEach(function(entry) {
                  if(entry['angle'] > 0){
                    var windDeg = (entry['angle'])/Math.PI*180;
                    var speedKnots = entry['speed']/1852*3600;
                    //console.log(windDeg + ',' + speedKnots);
                    var polarItem = [windDeg , speedKnots];
                    stbPolar.push(polarItem); //positive angles                   

                  }

                  if(entry['angle'] < 0){
                    var windDeg = (entry['angle']/Math.PI*180);
                    var speedKnots = entry['speed']/1852*3600;
                   // console.log(windDeg + ',' + speedKnots);
                    var polarItem = [windDeg , speedKnots];
                    stbPolar.push(polarItem); //negative angles
                    
                  }
                  
                });
		stbPolar.push([0 , 0])      
		stbPolar.sort(function(a,b){return a[0] - b[0]; });      
                chart.series[seriesStart].setData(stbPolar,true);
                chart.series[seriesStart].setName(polarWind[polarWindIndex],true) 
                polarWind[polarWindIndex]=windSpeed*1.9438;
                options = chart.options;
              });
		  
            }
		
		//, 1000);
	 setInterval(function(){
	  // var today = new Date(); 
           var chart = $('#container').highcharts();
	   var windMinSlider = document.getElementById("windMin");
	   var windStepSlider = document.getElementById("step");
          // var windMinSlider = $('#myRange')[0];
	  // chart.setTitle(null, {text: windMinSlider.innerHTML +"~"+(today).getSeconds()}); 
	  test(parseInt(windMinSlider.value)/1.9438,0,stbPolar5,0,chart);       
          test((parseInt(windStepSlider.value)+parseInt(windMinSlider.value))/1.9438,1,stbPolar10,1,chart);
          test((parseInt(windStepSlider.value)*2+parseInt(windMinSlider.value))/1.9438,2,stbPolar15,2,chart);
          test((parseInt(windStepSlider.value)*3+parseInt(windMinSlider.value))/1.9438,3,stbPolar20,3,chart);
          test((parseInt(windStepSlider.value)*4+parseInt(windMinSlider.value))/1.9438,4,stbPolar25,4,chart);
          test((parseInt(windStepSlider.value)*5+parseInt(windMinSlider.value))/1.9438,5,stbPolar30,5,chart);
	  }
	,10000);
	var chart = $('#container').highcharts();
	chart.setSize(
              $(container).width(),
              $(container).height(),
              false
        );
	}

        }
      }

    },

    legend: {
      layout : `${layout}`,
      verticalAlign : `${verticalAlign}`,
      align : `${align}`,
      symbolHeight: 48,
      symbolWidth: 48
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
      labels: {
        formatter: function () {
          return this.value + '°';
        }
	
      },
    /*plotLines: [{
        color: 'red', // Color value
        dashStyle: 'shortdashdot', // Style of the plot line. Default to solid
        value: y,//getTarget().Tack, // Value of where the line will appear
        width: 2, // Width of the line
        id: 'tack',
        label: {
          text:'speed through water '+Math.round(y/1.9438) + "kn",
          verticalAlign: 'center',
          textAlign: 'center',
          rotation: tackAngle-90,
          x: 90
        }
      },  {
        color: 'blue', // Color value
        dashStyle: 'shortdashdot', // Style of the plot line. Default to solid
        value: x, // Value of where the line will appear
        width: 2, // Width of the line
        id: 'reach', //see http://www.highcharts.com/docs/chart-concepts/plot-bands-and-plot-lines for dynamically updating
        label: {
          text: 'angle apparent '+Math.round( x) + '°',
          verticalAlign: 'right',
          textAlign: 'top',
          rotation: reachAngle-90,
          x: 20
        }
      }]*/
    },{
      tickInterval: 45,
      min:0,
      max:360,
      visible: false,
      
       }],

    yAxis: [{
       // title: { text: 'polarWind[]' }
    }, {
       visible: false,
       // title: { text: 'Histogram' },
       // opposite: true
       reversed: false
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
      type: 'line',
      name: polarWind[0],
      data: stbPolar5,
      connectEnds: false,
      turboThreshold: 0,
      marker: false,	    
    }, {
      type: 'line',
      name: polarWind[1],
      data: stbPolar10,
      connectEnds:false,
      turboThreshold: 0,
      marker: false,	    
    }, {
      type: 'line',
      name: polarWind[2],
      data: stbPolar15,
      connectEnds: false,
      turboThreshold: 0,
      marker: false,
    }, {
      type: 'line',
      name: polarWind[3],
      data: stbPolar20,
      connectEnds: false,
      turboThreshold: 0,
      marker: false,
    }, {
      type: 'line',
      name: polarWind[4],
      connectEnds: false,
      turboThreshold: 0,
      marker: false,
    }, {
      type: 'line',
      name: polarWind[5],
      data: stbPolar30,
      connectEnds: false,
      turboThreshold: 0,
      marker: false,	    
    },{
      name: ' ',//'Histogram',
      type: 'histogram',
      color: 'rgba(255, 255, 255, 0)',
      yAxis: 1,
      xAxis: 1,
      //data: [],
      //stacking: 'percent'
    },{
      name: 'awa histogram',
      type: 'histogram',
      color: 'red',
      yAxis: 1,
      xAxis: 1,
      //stacking: 'percent',
    }]
   
   
   	  
  });
    $('#toggle').click(function(){
    var chart = $('#container').highcharts(),
    options = chart.options;
    switchPolar(!options.chart.polar);

   });
/*
  function switchPolar(p) {
    var chart = $('#container').highcharts(),
    options = chart.options;
    options.chart.polar = p;
    if(options.chart.polar)
    {
	document.getElementById("toggle").innerHTML = "Line";
	//chart.options.plotOptions.histogram.stacking = 'percent';
    }
    else
    {
        document.getElementById("toggle").innerHTML = "Polar";
	chart.options.plotOptions.histogram.stacking = 'normal';
	chart.series[7].setData([],true,true,false);
    }

    saveCookies();
//    options.legend.layout.vertical= options.legend.layout.horizontal;
    $('#container').highcharts(options);
  }
*/


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
 	  
  

 // $(window).onresize(function()	  
 // {
//	  chart.setsize(
//		$(document).width(),
//		$(document).height(),
//		false
//	  );
//  });		  
});




