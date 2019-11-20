//to do:
//-maybe: add at 2D view
//-maybe: scroll to zoom
//-maybe: mobile friendly click and drag

//-test on linux and windows
//-upload to lee (once lee is back on line)

var gl;
var program;
var shapes = [];
var world2clip;
var lightView = new PV(-50, -50, -20, true);
var lightWorld;
var eyeWorld;
var path_index = 0;
var startTime;
var step_time = 15; //milliseconds 
var robot,lattice, ramp;
var play = 1;

window.onload = function init()
{
    //init canvas
    var canvas = document.getElementById( "gl-canvas" );
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }
    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    //init shapes
    lattice = new Shape(gl, latticeverts, latticefaces, new PV(0.0, 0.0, 0.0, 1.0));
    ramp = new Shape(gl, rampverts, rampfaces, new PV(0.5, 0.5, 0.5, 0.9));
    robot = new Shape(gl, robotverts, robotfaces, new PV(0.3, 0.6, 1.0, 1.0));
    shapes.push(lattice);
    shapes.push(ramp);
    shapes.push(robot);
    updateRobotPos();
    smoothPath();

    //initialize globals
    var world2view = Mat.translation(new PV(0,0,-15,true)).times(Mat.rotation(0,-1.4)).times(Mat.rotation(2,-0.25));
    var view2world = Mat.rotation(2,0.25).times(Mat.rotation(0, 1.4)).times(Mat.translation(new PV(0,0, 15,true)));

    var near = 0.1, far = 50.0;
    function setPerspective () {
        var a = -(far+near)/(far-near);
        var b = -(2*far*near)/(far-near);
        view2proj = new Mat();
        view2proj[2][2] = a;
        view2proj[2][3] = b;
        view2proj[3][2] = -1;
        view2proj[3][3] = 0;

        var a2 = 1/b;
        var b2 = a/b;
        proj2view = new Mat();
        proj2view[2][2] = 0;
        proj2view[2][3] = -1;
        proj2view[3][2] = a2;
        proj2view[3][3] = b2;

        updateM2C();
    }
    var aspect = canvas.width / canvas.height;
    var proj2clip = Mat.scale(new PV(1 / aspect, 1, 1, true));
    var clip2proj = Mat.scale(new PV(aspect, 1, 1, true));
    var zoom = 5.0;
    document.getElementById("slider").value = zoom;
    function setZoom () {
        proj2clip = Mat.scale(new PV(zoom / aspect, zoom, 1, true));
        clip2proj = Mat.scale(new PV(aspect/zoom, 1/zoom, 1, true));
        updateM2C();
    }
    var clip2canvas =
        Mat.scale(new PV(canvas.width / 2.0, -canvas.height / 2.0, 1, true))
        .times(Mat.translation(new PV(1, -1, 0, false)));
    var canvas2clip =
        Mat.translation(new PV(-1, 1, 0, false))
        .times(Mat.scale(new PV(2.0 / canvas.width, -2.0 / canvas.height, 1, true)));
    setPerspective();
    updateM2C();

    function updateM2C () {
        //update model2world for eash shape
        // for (var i=0; i<shapes.length; i++)
            // shapes[i].updateModel2World();

        //update world2clip globally 
        world2clip = proj2clip.times(view2proj).times(world2view);

        eyeWorld = view2world.times(new PV(0,0,0,true));
        lightWorld = view2world.times(lightView);
    }

    document.getElementById("slider").oninput = function(event) {
        zoom = parseFloat(event.target.value);
        console.log("zoom " + zoom);
        setZoom();
    };

    document.getElementById("speed").oninput = function(event) {
        var speed = parseFloat(event.target.value);
        step_time = (21-speed)*5;
    };

    setPerspective();
    setZoom();
    updateM2C();

    var mouseDown, mouseIsDown;

    //-- ARCBALL: click and drag to rotate around the origin of the world
    function getArcBallVector(x, y) { //defines the sphere in view space, returns vectors in world space
      //x and y are pixels
      var fCanvas = new PV(x, y, -1, true);
      var bCanvas = new PV(x, y, 1, true);
      var f = view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(fCanvas)))).homogeneous();
      var b = view2world.times(proj2view.times(clip2proj.times(canvas2clip.times(bCanvas)))).homogeneous();

      //define the sphere (in world coordinates)
      var center = new PV(0,0,0,true);
      var front = view2world.times(new PV(0,0,-near,true));
      var r = front.minus(center).magnitude();

      //find where fb intersects the imaginary sphere
      var q=f;
      var v=b.minus(f);
      //ray: q+s*v for any s in [0,1]
      var A = v.dot(v);
      var B = 2*q.minus(center).dot(v);
      var C = q.minus(center).dot(q.minus(center)) - r^2;
      // use quadratic formula
      var inner = B*B - 4*A*C;
      if (inner > 0) {
        var s = (-B - Math.sqrt(inner))/2/A;
        return q.plus(v.times(s)).minus(center);
      }

      return null; //cursor lies outside of sphere so we don't scroll
    }

    var lastx, lasty, mouseIsDown = false;
    function mouseDown (e) {
      mouseIsDown = true;
      lastx = e.clientX - canvas.offsetLeft;
      lasty = e.clientY - canvas.offsetTop;
    }

    function mouseUp (e) {
      mouseIsDown = false;
    }

    function mouseMove (e) {
      if (!mouseIsDown)
          return;
      var currx = e.clientX - canvas.offsetLeft;
      var curry = e.clientY - canvas.offsetTop;
      if (lastx == currx && lasty == curry)
        return;

      //all in world coordinates
      v = getArcBallVector(lastx, lasty);
      w = getArcBallVector(currx, curry);

      if (v == null || w == null)
          return;

      v.unitize();
      w.unitize();

      //find transformation from v to w
      var vx = v.unit();
      var vz = v.cross(w).unit();
      var vy = vz.cross(vx);
      var wx = w.unit();
      var wz = vz;
      var wy = wz.cross(wx);
      var vMat = new Mat(vx, vy, vz);
      var wMat = new Mat(wx, wy, wz);
      var v2w = wMat.times(vMat.transpose());
      var w2v = vMat.times(wMat.transpose());

      world2view = world2view.times(v2w);
      view2world = w2v.times(view2world);

      updateM2C();

      lastx = currx;
      lasty = curry;
    }

    canvas.addEventListener("mousedown", mouseDown);
    canvas.addEventListener("mouseup", mouseUp);
    canvas.addEventListener("mousemove", mouseMove);
    // canvas.addEventListener("touchstart", mouseDown);
    // canvas.addEventListener("touchend", mouseUp);
    // canvas.addEventListener("touchmove", mouseMove);

    //------

    function smoothPath() {
        step_size = 0.02;
        n = 2; //number of intermediate frames to insert on angle change

        new_path = [path[0]];
        acc_dist = 0;
        index = 1;
        while (index < path.length-1) {
          if (path[index][3] != path[index-1][3]) {
            //new_path.push(path[index]);

            var amax = Math.max(path[index][3], path[index-1][3]);
            var amin = Math.min(path[index][3], path[index-1][3]);
            diff = amax - amin;
            sign = -1;
            if ((2*Math.PI - amax + amin) < diff) { //we cross the 2PI boundary
                diff = (2*Math.PI - amax + amin);
                sign = 1;
            }

            var steps = [];
            for (var j=1; j<=n; j++)
                steps.push(new PV(path[index][0], path[index][1], path[index][2], (amax + sign * j * diff/(n+1)) ));
            if (amax != path[index-1][3])
                steps = steps.reverse();
            steps.push(path[index]);
            new_path = new_path.concat(steps);

            acc_dist = 0;
            index++;
            continue;
          }

          v = path[index].minus(path[index-1]);
          v[3] = 0;
          new_dist = v.magnitude();
          if (acc_dist+new_dist < step_size) {
            acc_dist = acc_dist + new_dist;
            index++;
            continue;
          }

          //we need to go fraction f of the way from path[index-1] to path[index];
          var f = (step_size-acc_dist)/new_dist;
          var p = path[index-1].plus(v.times(f));
          new_path.push(p);

          //what if there are multiple steps in one iteration? 
          var rem_dist = new_dist - (step_size-acc_dist);
          while (rem_dist >= step_size) {
            //we need to go from position f along v to position f+step_size/new_dist
            f = f+step_size/new_dist;
            p = path[index-1].plus(v.times(f));
            new_path.push(p);

            rem_dist = rem_dist - step_size;
          }
          
          acc_dist = rem_dist;
          index++;
        }

        path = new_path;
    }

    window.onresize = function (event) {
        console.log("resize " + canvas.width + " " + canvas.height);
    }

    document.getElementById("playpause").onclick = function () { 
        play = (play == 1? 0 : 1); 
        document.getElementById("playpause").innerText = (play == 1? "Pause" : "Play");
    }

    startTime = new Date();
    render();
};

function updateRobotPos() {
    var pos = path[path_index];
    var r = pos[3];
    var t = new PV(pos[0], pos[1], pos[2], 1.0);

    robot.object2rotated = Mat.rotation(2, r);
    robot.rotated2object = Mat.rotation(2, -r);
    robot.rotated2world = Mat.translation(t);
    robot.world2rotated = Mat.translation(t.minus());
    robot.updateModel2World();
}

function render() {
    endTime = new Date();
    if (play == 1 && endTime - startTime >= step_time) {
        startTime = endTime;
        path_index = (path_index+1)%path.length;
        updateRobotPos();
    }

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    var lightLoc = gl.getUniformLocation(program, "lightWorld");
    var eyeLoc = gl.getUniformLocation(program, "eyeWorld");
    var world2clipLoc = gl.getUniformLocation( program, "world2clip" );

    gl.uniformMatrix4fv(world2clipLoc, false, world2clip.flatten());
    gl.uniform4fv(lightLoc, lightWorld.flatten());
    gl.uniform4fv(eyeLoc, eyeWorld.flatten());

    robot.render();
    lattice.render();
    
    var alpha = ramp.color[3];
    ramp.color[3] = 0.0;
    ramp.render();
    ramp.color[3] = alpha;
    ramp.render();

    requestAnimFrame( render )
}
