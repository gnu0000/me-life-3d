//
// Life3d.js
//
// A canvas toy
// Craig Fitzgerald
//
// you can set the update interval using cgi params:  
//   life.html?interval=400
//

$(function() {
   var scene = new CellLife3d($("#petridish").get(0));
});

//weight drops off as a square of distance
var WEIGHT_SELF   = 0  ;      // self
var WEIGHT_FACE   = 1.0;      // neighboring cube sharing a face
var WEIGHT_EDGE   = 0.5;      // neighboring cube sharing an edge
var WEIGHT_CORNER = 0.33333;  // neighboring cube sharing a corner

// the low end of the possible values given the above weights...
//
// 0.333, 0.5  , 0.666, 0.833, 0.999, 1    , 1.166, 1.333, 1.499, 1.5  , 
// 1.666, 1.833, 1.999, 2    , 2.166, 2.333, 2.499, 2.5  , 2.666, 2.833, 
// 2.999, 3    , 3.166, 3.333, 3.499, 3.5  , 3.666, 3.833, 3.999, 4    , 
// 4.166, 4.333, 4.499, 4.5  , 4.666, 4.833, 4.999, 5    , 5.166, 5.333, 
// 5.499, 5.5  , 5.666, 5.833, 5.999, 

var MIN_LIFE    = 1.00; //1.00; //1.00; //1.00; //2.00;//2.00;
var MIN_FERTILE = 1.84; //1.84; //1.84; //2.17; //2.17;//2.30;
var MAX_FERTILE = 2.15; //2.00; //2.15; //2.34; //2.34;//2.51;
var MAX_LIFE    = 2.49; //2.60; //2.60; //2.95; //2.85;//2.90;


function CellLife3d(canvas, options){
   var self = this;

   this.Init = function(canvas, options){
      self.InitAttributes(canvas, options);
      self.InitEvents();
      self.InitState ();
   };
   
   this.InitAttributes = function(canvas, options){
      self.activeSet = 0;
      self.canvas = canvas;
      self.ctx    = canvas.getContext('2d');
      self.step   = 0;
      self.states = [];
      
      var defaults = {
         gridCount: 32,  // 26
         cellSize:  38,  // 45
         cellGap:   5 ,
         interval:  20,
         distance:  1.75
      };
      self.options = $.extend(defaults, options || {});
      self.options.interval   = Number(self.UrlParam("interval", self.options.interval));
      self.options.cellHue    = Math.random() * 360;
      self.options.bgHue      = Math.random() * 360;
      self.options.bgHueGap   = Math.random() * 270 + 45;
      self.options.cellSpace  = self.options.cellSize  + self.options.cellGap;
      self.options.gridSize   = self.options.cellSpace * self.options.gridCount;
      self.options.cellRadius = self.options.cellSize / 2;
      self.options.xGrid      = self.options.yGrid = self.options.zGrid = self.options.gridCount;
      self.editMode           = 0;

      self.Resize();
   };
   
   this.InitEvents = function(){
      $(window).keyup(self.KeyUp)
               .resize(self.Resize);
   };

   this.InitState = function(){
      self.CreateCells();
      self.interval = setInterval(self.Step, self.options.interval);
   };

   this.Resize = function(){
      var x = $(window).width() ;
      var y = $(window).height();
      $('body').width (x);
      $('body').height(y);
      $(self.canvas).width (x);
      $(self.canvas).height(y);
      self.canvas.width  = x;
      self.canvas.height = y;
   };

   this.CreateCells = function (){
      var newSize  = self.options.zGrid * self.options.yGrid * self.options.xGrid;
      self.currentSet = self.cellArray0 = new Int8Array(newSize);
      self.workingSet = self.cellArray1 = new Int8Array(newSize);
      self.activeSet = 0;

      for (var z=Math.floor(self.options.zGrid/3); z<self.options.zGrid*2/3; z++){
         for (var y=Math.floor(self.options.yGrid/3); y<self.options.yGrid*2/3; y++){
            for (var x=Math.floor(self.options.xGrid/3); x<self.options.xGrid*2/3; x++){
               if (Math.random()*100 > 80) {
                  self.Cell(z, y, x, 1);
               }
            }
         }
      }
   };

   this.Step = function () {
      self.step++;
      self.options.cellHue += 0.5;
      self.options.bgHue   -= 0.2;
      var h = self.options.bgHueGap;
      self.options.cellColor = self.HSLA (self.options.cellHue, "75%", "40%", 1);
      self.options.bgColor0  = self.HSLA (self.options.bgHue+h, "65%", "18%", 1);
      self.options.bgColor1  = self.HSLA (self.options.bgHue  , "65%", "18%", 1);

      self.DrawBackground();
      self.Draw();
      self.Update();
   };

   this.DrawBackground = function () {
      self.bkgGradient = self.ctx.createLinearGradient(0, 0, 0, canvas.height);
      self.bkgGradient.addColorStop(0, self.options.bgColor0);
      self.bkgGradient.addColorStop(1, self.options.bgColor1);
      self.ctx.fillStyle = self.bkgGradient;
      self.ctx.fillRect(0, 0, self.canvas.width, self.canvas.height);
   };

   this.Draw = function () {
      for (var z=0; z<self.options.zGrid; z++){
         for (var y=0; y<self.options.yGrid; y++){
            for (var x=0; x<self.options.xGrid; x++){
               if (self.Cell(z,y,x)) self.DrawCell(z,y,x);
            }
         }
      }
   };   

   this.Update = function () {
      if (self.IsDead())
         return self.CreateCells();

      for (var z=0; z<self.options.zGrid; z++){
         for (var y=0; y<self.options.yGrid; y++){
            for (var x=0; x<self.options.xGrid; x++){
               var live  = self.Cell(z,y,x);
               var score = self.Score(z,y,x);
               var lives = ((live && score >= MIN_LIFE    && score <= MAX_LIFE)  ||
                            (!live && score >= MIN_FERTILE && score <= MAX_FERTILE));
               self.WorkingCell(z,y,x,lives);
            }
         }
      }
      self.SwapCellSet();
   };

   this.Score = function (z, y, x) {
      var score = 0;
      for (var dz=-1; dz<2; dz++){
         for (var dy=-1; dy<2; dy++){
            for (var dx=-1; dx<2; dx++){
               //if (!dz && !dy && !dx) continue;
               var rz = (self.options.zGrid + z + dz) % self.options.zGrid;
               var ry = (self.options.yGrid + y + dy) % self.options.yGrid;
               var rx = (self.options.xGrid + x + dx) % self.options.xGrid;
               var key = self.Key(rz, ry, rx);
               if (self.Cell(rz,ry,rx)) {
                  var idx = 0;
                  if (!dx) val++;
                  if (!dy) val++; 
                  if (!dz) val++;
                  var val = [WEIGHT_CORNER,WEIGHT_EDGE,WEIGHT_FACE,WEIGHT_SELF][idx];
                  score += val;
               }
            }
         }
      }
      return score;
   };

   this.DrawCell = function (z,y,x) {
      var zScale = 1.7;

      // spatial position
      var cx = x * self.options.cellSpace - self.options.gridSize/2;
      var cy = y * self.options.cellSpace - self.options.gridSize/2;
      var cz = (self.options.gridSize * self.options.distance - z * self.options.cellSpace * zScale);

      // view positioning
      var vx = (cx / cz) * self.options.gridSize + self.canvas.width/2;
      var vy = (cy / cz) * self.options.gridSize + self.canvas.height /2;
      var vr = (self.options.cellRadius / cz) * self.options.gridSize  + 1;

      //console.log ("["+cx+","+cy+","+cz+"] => ("+vx+","+vy+","+vr+")");
      self.DrawBubble(vx, vy, vr);
   };

   this.DrawBubble = function (x,y,r) {
      var gradient = self.ctx.createRadialGradient(x+r/4, y-r/4, r/5, x, y, r);
      gradient.addColorStop(0,    '#fff'                );
      gradient.addColorStop(0.85, self.options.cellColor);
      gradient.addColorStop(1,    'rgba(0,0,128,0)'     );
      self.ctx.fillStyle = gradient;
      self.ctx.fillRect(x-r, y-r, r*2, r*2);
   };

   // check once every 50 iterations
   this.IsDead = function () {
      var i = self.step % 50;
      if (i < 45) return false;
      return self.StateCheck(i - 45);
   }

   this.StateCheck = function (index) {
      self.states[index] = self.BuildState();
      if (index < 4) return false;
      return (self.states[0] == self.states[2] && self.states[2] == self.states[4]);
   };

   this.BuildState = function () {
      var state = "";
      for (var z=0; z<self.options.zGrid; z++){
         for (var y=0; y<self.options.yGrid; y++){
            for (var x=0; x<self.options.xGrid; x++){
               if (self.Cell(z,y,x)) {
                  state += self.Key(z, y, x);
               }
            }
         }
      }
      return state;
   };


   this.ClearCellGrid = function(){
      self.currentSet.fill(0);
   };

   this._Cell = function(set, z, y, x, val){
      var i = z *  self.options.yGrid * self.options.xGrid +
              y *  self.options.xGrid +
              x;
      if (val != undefined) return set[i] = val;
      return set[i];
   };

   this.Cell = function(z, y, x, val){
      return self._Cell(self.currentSet, z, y, x, val);
   };

   self.WorkingCell = function(z, y, x, val){
      return self._Cell(self.workingSet, z, y, x, val);
   };

   // we have 2 arrays, The first is on the screen and is used to generate
   // the second. and then we swap. Rinse and repeat.
   //
   this.SwapCellSet = function(){
      self.activeSet = 1 - self.activeSet;
      self.currentSet = self.activeSet ? self.cellArray1 : self.cellArray0;
      self.workingSet = self.activeSet ? self.cellArray0 : self.cellArray1;
   };

   // ' ' - edit mode   // 'c' - clear   // 'n' - new    //
   this.KeyUp = function (event){
      if (event.originalEvent.keyCode == 32){
         self.editMode = 1 - self.editMode;
         if (self.editMode){
            clearInterval(self.interval);
         } else {
            self.interval = setInterval(self.Step, self.options.interval);
         }
      }
      if (event.originalEvent.keyCode == 67){ // c = clear
         self.ClearCellGrid();
         self.DrawBackground();
         self.Draw();
      }
      if (event.originalEvent.keyCode == 78){ // n = new
         self.CreateCells()
         self.DrawBackground();
         self.Draw();
      }
   };

   this.HSLA = function (h, s, l, a) {
      return 'hsla('+h+','+s+','+l+','+a+')';
   };

   this.Key = function (z, y, x) {
      var key = "z:"+z+",y:"+y+",x:"+x;
      return key;
   }

   this.UrlParam = function (name, defaultVal) {
      var results = new RegExp('[\\?&]' + name + '=([^&#]*)').exec(window.location.href);
      if(results)
         return decodeURIComponent(results[1]);
      return defaultVal;
   };

   this.Init(canvas, options);
};
