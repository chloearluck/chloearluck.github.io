var gl;
var texture_program, render_program, program;
var canvas;
var cube;
var model2clip, model2world;
var fb, fb_texture;
var voxel_i, voxel_tex;
var intensityImage;

// var voxel_source = "cspace2.png";
// var voxel_source = "cspace-bgp.png";
var voxel_source = "cspace-ryb.png";
sources = [ "cspace-bgp.png","cspace2.png","cspace-ryb.png" ];

var renderview = 3;
var alpha1 = 0.01;
var alpha2 = 0.04;
var steps = 256;

window.onload = function init()
{
    var camera_dist = 10;
    var near = camera_dist - .9;
    var far = 50.0;

    canvas = document.getElementById( "gl-canvas" );
    
    gl = WebGLUtils.setupWebGL( canvas );
    if ( !gl ) { alert( "WebGL isn't available" ); }

    texture_program = initShaders( gl, "texture-vertex-shader", "texture-fragment-shader" );
    render_program = initShaders( gl, "vertex-shader", "fragment-shader" );

    cube = new Cube(gl);

    var modelT = new PV(-0.5, -0.5, -0.5, false);
    var model2object = Mat.translation(modelT);
    var object2model = Mat.translation(modelT.minus());

    var object2rotated = new Mat();
    var rotated2object = new Mat();

    var translation = new PV(0, 0, 0, false);
    var rotated2world = Mat.translation(translation);
    var world2rotated = Mat.translation(translation.minus());

    var world2view = Mat.translation(new PV(0,0,-camera_dist, true));
    var view2world = Mat.translation(new PV(0,0, camera_dist, true));
        
    // Simple orthographic projection.
    var view2proj = Mat.scale(new PV(1, 1, -1, false));
    var proj2view = view2proj;
 
    
    function setPerspective () {
        var a = far+near;
        var b = 2*far*near;
        var diff =  far-near;
        a = -a/diff;
        b = -b/diff;

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

    function setOrthographic () {
        var r = (far-near)/2;
        var t1 = new Mat.translation(new PV(0,0,   r+near, 0));
        var t2 = new Mat.translation(new PV(0,0, -(r+near),0));
        var s1 = new Mat.scale(new PV(1,1,-1/r,0));
        var s2 = new Mat.scale(new PV(1,1,-r/1,0));

        view2proj = s1.times(t1);
        proj2view = t2.times(s2);
        updateM2C();
    }




    var aspect = canvas.width / canvas.height;
    var proj2clip = Mat.scale(new PV(1 / aspect, 1, 1, true));
    var clip2proj = Mat.scale(new PV(aspect, 1, 1, true));

    var zoom = 10;
    setZoom();

    function setZoom () {
        console.log("zoom: " + zoom);
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
        model2clip = proj2clip.times(view2proj).times(world2view).times(rotated2world).times(object2rotated).times(model2object);
    }

    document.getElementById("slider").oninput = function(event) {
        zoom = parseFloat(event.target.value);
        setZoom();
    };

    document.getElementById("alpha1").value = alpha1;
    document.getElementById("alpha1").oninput = function(event) {
        console.log("alpha1: " + event.target.value);
        alpha1 = parseFloat(event.target.value);
    };

    document.getElementById("alpha2").value = alpha2;
    document.getElementById("alpha2").oninput = function(event) {
        console.log("alpha2: " + event.target.value);
        alpha2 = parseFloat(event.target.value);
    };

    document.getElementById("stepslider").value = steps;
    document.getElementById("stepslider").oninput = function(event) {
        console.log("steps: " + event.target.value);
        steps = parseInt(event.target.value);
    };

    document.getElementById("ZPlus").onclick = function () {
        world2view = new Mat.translation(new PV(0,0,0.1,1)).times(world2view);
        view2world = view2world.times(new Mat.translation(new PV(0,0,-0.1,1)));
        updateM2C();
    };

    document.getElementById("ZMinus").onclick = function () {
        world2view = new Mat.translation(new PV(0,0,-0.1,1)).times(world2view);
        view2world = view2world.times(new Mat.translation(new PV(0,0,0.1,1)));
        updateM2C();
    };

    canvas.addEventListener("mousedown", function (e) {
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
        var theta = axis.magnitude() * 0.05; //will probably need to scale
        var axis = axis.unit();

        //rotate about axis
        var cost = Math.cos(theta);
        var sint = Math.sin(theta);
        var ux = axis[0];
        var uy = axis[1];
        var uz = axis[2];
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

        view2world = R.times(view2world);
        world2view = world2view.times(R.transpose());

        updateM2C();
    });

    
    window.onkeydown = function( event ) {
        switch (event.keyCode) {
        case 37:
            world2view = new Mat.translation(new PV(0.1,0,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(-0.1,0,0,1)));
            updateM2C();
            break;
        case 38:
            world2view = new Mat.translation(new PV(0,-0.1,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(0,0.1,0,1)));
            updateM2C();
            break;
        case 39:
            // world2view = new Mat.translation(new PV(-0.1,0,0,1)).times(world2view);
            // view2world = view2world.times(new Mat.translation(new PV(0.1,0,0,1)));
            view2world = Mat.translation(new PV(0.1, 0, 0, 1)).times(view2world);
            world2view = world2view.times(Mat.translation(new PV(-0.1, 0, 0, 1)))
            updateM2C();
            break;
        case 40:
            world2view = new Mat.translation(new PV(0,0.1,0,1)).times(world2view);
            view2world = view2world.times(new Mat.translation(new PV(0,-0.1,0,1)));
            updateM2C();
            break;
        }
        
        var key = String.fromCharCode(event.keyCode);
        var rotSign = event.shiftKey ? -1 : 1;
        switch( key ) {
        case 'X':
            view2world = Mat.rotation(0, 0.1*rotSign).times(view2world);
            world2view = world2view.times(Mat.rotation(0, -0.1*rotSign));
            break;
            
        case 'Y':
            view2world = Mat.rotation(1, 0.1*rotSign).times(view2world);
            world2view = world2view.times(Mat.rotation(1, -0.1*rotSign));
            break;
            
        case 'Z':
            view2world = Mat.rotation(2, 0.1*rotSign).times(view2world);
            world2view = world2view.times(Mat.rotation(2, -0.1*rotSign));
            break;
        }

        if (key == '1')
            renderview = 1;
        if (key == '2')
            renderview = 2;
        if (key == '3')
            renderview = 3;
        if (key == '4')
            renderview = 3;
        
        if (key == 'M') 
            banner_pos += 0.008;
        if (key == 'N')
            banner_pos -= 0.008;
        if (key == 'M'  || key == 'N') {
            console.log("banner_pos: "+ banner_pos);
            var z = (banner_pos+1)/2;
            var frame = Math.floor(255*z);
            console.log("z: " + z + ", frame: " + frame);
        }


        updateM2C();
    };

    model2world = rotated2world.times(object2rotated.times(model2object));

    //grab the depth texture extension. this call loads the extension
    //into the runtime, we need to keep a reference to the returned
    //variable even though we never use it.
    depthTextureExt = gl.getExtension("WEBGL_depth_texture"); 
    if(!depthTextureExt) { 
      alert("WEBGL_depth_texture not supported\nTry a newer browser"); 
      return; 
    }

    
    loadVoxelTexture();


    

    initTextureBuffers();
    
    render();
};

function render() {
    
    //-- RENDER TEXTURE --//
    gl.useProgram( texture_program );
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.blendFunc( gl.SRC_ALPHA, gl.ONE  );
    if ( renderview == 1 || renderview == 2) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, canvas.width, canvas.height);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.viewport(0, 0, fb.width, fb.height);   
    }
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    
    if (renderview == 2)
        gl.cullFace(gl.BACK); //show the front face coordinates in render_view 2
    else
        gl.cullFace(gl.FRONT); //backface culling
    gl.enable(gl.CULL_FACE);

    gl.enable(gl.DEPTH_TEST);
    
    var model2clipLoc = gl.getUniformLocation( texture_program, "model2clip" );
    var model2worldLoc = gl.getUniformLocation( texture_program, "model2world" );

    gl.uniformMatrix4fv(model2clipLoc, false, model2clip.flatten());
    gl.uniformMatrix4fv(model2worldLoc, false, model2world.flatten());

    cube.render(gl, texture_program);
    //-------------------//


    if (renderview == 3) {
        //--- RENDER VIEW ---//
        program = render_program;
        gl.useProgram( program );
        gl.clearColor( 0.0, 0.0, 0.0, 1.0 );
        gl.enable(gl.DEPTH_TEST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport( 0, 0, canvas.width, canvas.height );
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);

        gl.enable(gl.DEPTH_TEST);
        

        var model2clipLoc = gl.getUniformLocation( program, "model2clip" );
        var model2worldLoc = gl.getUniformLocation( program, "model2world" );
        var backTexLoc = gl.getUniformLocation(program, "backTex");
        var cubeTexLoc = gl.getUniformLocation(program, "cubeTex");
        var intensityImageLoc = gl.getUniformLocation(program, "intensityImage");
        var alpha1Loc = gl.getUniformLocation(program, "alpha1");
        var alpha2Loc = gl.getUniformLocation(program, "alpha2");
        var stepsLoc = gl.getUniformLocation(program, "steps");

        gl.uniformMatrix4fv(model2clipLoc, false, model2clip.flatten());
        gl.uniformMatrix4fv(model2worldLoc, false, model2world.flatten());
        gl.uniform1i(intensityImageLoc, intensityImage);
        gl.uniform1f(alpha1Loc, alpha1);
        gl.uniform1f(alpha2Loc, alpha2);
        gl.uniform1i(stepsLoc, steps);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, fb_texture);
        gl.uniform1i(backTexLoc, 0);

        if (!voxel_tex) {
            requestAnimFrame( render )
            console.log("!voxel_tex");
            return;
        }
        gl.activeTexture(gl.TEXTURE1);
        gl.uniform1i(cubeTexLoc, 1);
        voxel_tex.bind(gl);

        cube.render(gl, program);
        //---------------------//
    }

    requestAnimFrame( render )
}

var loadVoxelTexture = function () {
    //teapot, foot, or bonzai
    voxel_im = new Image();
    voxel_im.onload = function() {
        console.log("voxel_im loading...");
        voxel_tex = Texture2D.create(gl, Texture2D.Filtering.BILINEAR,Texture2D.Wrap.MIRRORED_REPEAT, 
                                    voxel_im.width, voxel_im.height, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, voxel_im);
        console.log("voxel_im loaded");

    };
    voxel_im.src = voxel_source;
    voxel_im.v_slices = 16;
    voxel_im.h_slices = 16;

    if (voxel_source == "teapot.raw.png" || voxel_source == "bonsai.raw.png" || voxel_source == "foot.raw.png")
        intensityImage = 1;
    else
        intensityImage = 0;
}

var initTextureBuffers =function () {
    //frame buffer (color)
    fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    fb.width = 512;
    fb.height = 512;

    //texture 
    fb_texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, fb_texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST/*gl.LINEAR_MIPMAP_NEAREST*/);
    //gl.generateMipmap(gl.TEXTURE_2D);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fb.width, fb.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    //depth buffer
    var renderbuffer = gl.createRenderbuffer(); //this is memory the graphics card will use to hold the depth info (we don't need that as a texture, but we do need the cube rendered in the proper order)
    gl.bindRenderbuffer(gl.RENDERBUFFER, renderbuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, fb.width, fb.height);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fb_texture, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, renderbuffer);

    //tidy up
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

var setSource = function (i) {
    console.log("src: ");
    console.log(sources[i]);
    voxel_source = sources[i];
    loadVoxelTexture();
    initTextureBuffers();
}
