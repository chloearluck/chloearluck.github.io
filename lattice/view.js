var gl;
var program;
var shapes = [];
var world2clip;
// var lightWorld = new PV(10, 3, 10, true);
var lightView = new PV(-50, -50, 20, true);
var lightWorld;
var eyeWorld;
var path_index = 0;
var MAX_STEP_LENGTH = 0.1;
var startTime;
var step_time = 100; //milliseconds 
var robot;

window.onload = function init()
{
    var canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    gl.viewport( 0, 0, canvas.width, canvas.height );
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );
    
    program = initShaders( gl, "vertex-shader", "fragment-shader" );
    gl.useProgram( program );

    var lattice = new Shape(gl, latticeverts, latticefaces, new PV(0.0, 0.0, 0.0, 1.0));
    shapes.push(lattice);
    var ramp = new Shape(gl, rampverts, rampfaces, new PV(0.5, 0.5, 0.5, 1.0));
    shapes.push(ramp);
    robot = new Shape(gl, robotverts, robotfaces, new PV(0.3, 0.6, 1.0, 1.0));
    // var robot = new Shape(gl, robotverts, robotfaces, new PV(0.5, 0.5, 1.0, 1.0));
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


    document.getElementById("slider").onchange = function(event) {
        zoom = parseFloat(event.target.value);
        console.log("zoom " + zoom);
        setZoom();
    };

    setPerspective();
    setZoom();
    updateM2C();

    // document.getElementById("ZPlus").onclick = function () {
    //     world2view = new Mat.translation(new PV(0,0,0.1,1)).times(world2view);
    //     view2world = view2world.times(new Mat.translation(new PV(0,0,-0.1,1)));
    //     updateM2C();
    // };

    // //set the sliders bounds based on the size of path
    // document.getElementById("path").value = path_index;
    // document.getElementById("path").max = path.length-1;
    // document.getElementById("path").oninput = function(event) {
    //     console.log("path index: " + parseInt(event.target.value));
    //     path_index = parseInt(event.target.value);
    //     updateRobotPos();
    // };

    // document.getElementById("ZMinus").onclick = function () {
    //     world2view = new Mat.translation(new PV(0,0,-0.1,1)).times(world2view);
    //     view2world = view2world.times(new Mat.translation(new PV(0,0,0.1,1)));
    //     updateM2C();
    // };

    var mouseDown, mouseIsDown;
    canvas.addEventListener("mousedown", function (e) {
        console.log("mouse pressed");
        clientX = e.clientX;
        clientY = e.clientY;
        var cursorX = e.clientX - canvas.offsetLeft;
        var cursorY = e.clientY - canvas.offsetTop;
        mouseDown = new PV(cursorX, cursorY, 0, true);
        mouseIsDown = true;
    });

    canvas.addEventListener("mouseup", function (e) {
        mouseIsDown = false;
    });

    canvas.addEventListener("mousemove", function (e) {
        if (!mouseIsDown)
            return;
        //get previous mouse position in clip coordinates
        var clipX = mouseDown[0] * 2 / canvas.width - 1;
        var clipY = -(mouseDown[1] * 2 / canvas.height - 1);
        var clip1 = new PV(clipX, clipY, 0, true);

        //get current mouse position ins clip coordinates
        var cursorX = e.clientX - canvas.offsetLeft;
        var cursorY = e.clientY - canvas.offsetTop;
        var clipX = cursorX * 2 / canvas.width - 1;
        var clipY = -(cursorY * 2 / canvas.height - 1);
        var clip2 = new PV(clipX, clipY, 0, true);

        var diffClip = clip2.minus(clip1);

        var diffWorld = view2world.times(proj2view).times(clip2proj).times(diffClip).homogeneous();
        var eyeWorld = view2world.times(new PV(0,0,0,true));

        // var axis = eyeWorld.cross(diffWorld);
        var axis = diffWorld.cross(eyeWorld);
        var theta = axis.magnitude() * 0.005; //will probably need to scale
        // console.log(theta)
        var axis = axis.unit();

        //rotate about axis
        var cost = Math.cos(theta);
        var sint = Math.sin(theta);
        var ux = axis[0];
        var uy = axis[1];
        var uz = axis[2];

        if (cost === undefined || sint === undefined || ux === undefined || uy === undefined || uz === undefined) {
            console.log("undefined");
            return;
        }

        if (isNaN(cost) || isNaN(sint) || isNaN(ux) || isNaN(uy) || isNaN(uz)) {
            console.log("nan");
            return;
        }

        var R = new Mat();
        R[0][0] = cost + ux*ux*(1-cost);
        R[0][1] = ux*uy*(1-cost)-uz*sint;
        R[0][2] = ux*uz*(1-cost)+uy*sint;

        R[1][0] = ux*uy*(1-cost)+uz*sint;
        R[1][1] = cost + uy*uy*(1-cost);
        R[1][2] = uy*uz*(1-cost)-ux*sint;

        R[2][0] = uz*ux*(1-cost)-uy*sint;
        R[2][1] = uz*uy*(1-cost)+ux*sint;
        R[2][2] = cost + uz*uz*(1-cost);

        if (R === undefined) {
            console.log("bad rotation");
            return;
        }

        console.log("R: " + R)

        view2world = R.times(view2world);
        world2view = world2view.times(R.transpose());

        updateM2C();
    });

    window.onkeydown = function( event ) {
        switch (event.keyCode) {
        case 37:
            console.log('left');
            world2view = new Mat.translation(new PV(0.1,0,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(-0.1,0,0,1)));
            updateM2C();
            break;
        case 38:
            console.log('up');
            world2view = new Mat.translation(new PV(0,-0.1,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(0,0.1,0,1)));
            updateM2C();
            break;
        case 39:
            console.log('right');
            view2world = Mat.translation(new PV(0.1, 0, 0, 1)).times(view2world);
            world2view = world2view.times(Mat.translation(new PV(-0.1, 0, 0, 1)))
            updateM2C();
            break;
        case 40:
            console.log('down');
            world2view = new Mat.translation(new PV(0,0.1,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(0,-0.1,0,1)));
            updateM2C();
            break;
        }
        
        var key = String.fromCharCode(event.keyCode);
        var rotSign = event.shiftKey ? -1 : 1;
        console.log("You clicked " + key);
        switch( key ) {
        case 'X':
            shapes[0].object2rotated = Mat.rotation(0, 0.1 * rotSign).times(shapes[0].object2rotated);
            shapes[0].rotated2object = shapes[0].rotated2object.times(Mat.rotation(0, -0.1 * rotSign));
            break;
            
        case 'Y':
            shapes[0].object2rotated = Mat.rotation(1, 0.1 * rotSign).times(shapes[0].object2rotated);
            shapes[0].rotated2object = shapes[0].rotated2object.times(Mat.rotation(1, -0.1 * rotSign));
            break;
            
        case 'Z':
            shapes[0].object2rotated = Mat.rotation(2, 0.1 * rotSign).times(shapes[0].object2rotated);
            shapes[0].rotated2object = shapes[0].rotated2object.times(Mat.rotation(2, -0.1 * rotSign));
            break;
        }
        
        updateM2C();
    };

    function smoothPath() {
        // for steps that are larger than the maximum step size, split them up (divide by the smallest integer that makes the steps small enough)
        // don't worry about steps that are too small for now, just eliminate jumping

        console.log(path);

        var new_path = [path[0]];
        for (var i=1; i<path.length; i++) {
            var v = path[i].minus(path[i-1]);
            v[3] = 0;
            var d = v.magnitude();
            if (d > MAX_STEP_LENGTH) {
                var k = Math.ceil(d/MAX_STEP_LENGTH); 
                var inc = d/k;
                for (var j=1; j<k; j++)
                    new_path.push(path[i-1].plus(v.times(inc*j)));
            }
            new_path.push(path[i]);
        }

        path = new_path;
        console.log(path);
        console.log(new_path);

    }

    window.onresize = function (event) {
        console.log("resize " + canvas.width + " " + canvas.height);
    }


    startTime = new Date();
    render();
};


function updateRobotPos() {
    var pos = path[path_index];
    var r = pos[3];
    var t = new PV(pos[0], pos[1], pos[2], 1.0);

    // console.log("r: " + r);
    // console.log("t: " + t);
    // console.log("pos: " + pos);

    robot.object2rotated = Mat.rotation(2, r);
    robot.rotated2object = Mat.rotation(2, -r);
    robot.rotated2world = Mat.translation(t);
    robot.world2rotated = Mat.translation(t.minus());
    robot.updateModel2World();
}


function render() {
    endTime = new Date();
    if (endTime - startTime >= step_time) {
        startTime = endTime;
        path_index = (path_index+1)%path.length;
        updateRobotPos();
    }

    gl.enable(gl.DEPTH_TEST)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.clearColor( 1.0, 1.0, 1.0, 1.0 );

    var lightLoc = gl.getUniformLocation(program, "lightWorld");
    var eyeLoc = gl.getUniformLocation(program, "eyeWorld");
    var world2clipLoc = gl.getUniformLocation( program, "world2clip" );

    gl.uniformMatrix4fv(world2clipLoc, false, world2clip.flatten());
    gl.uniform4fv(lightLoc, lightWorld.flatten());
    gl.uniform4fv(eyeLoc, eyeWorld.flatten());

    for (var i=0; i<shapes.length; i++)
        shapes[i].render();


    requestAnimFrame( render )
}
