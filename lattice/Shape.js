function Shape (gl, verts, faces,color) {
  this.verts = verts;
  this.faces = faces;

  this.model2object = new Mat();
  this.object2model = new Mat();
  this.object2rotated = new Mat();
  this.rotated2object = new Mat();
  this.rotated2world = new Mat();

  this.model2world = new Mat();
  this.world2model = new Mat();

  this.color = color;

  this.normals  = [];
  for (var i=0; i<faces.length; i++) {
    var p0 = verts[faces[i][0]];
    var p1 = verts[faces[i][1]];
    var p2 = verts[faces[i][2]];
    var n = p2.minus(p0).cross(p1.minus(p0)).unit();
    this.normals.push(n);
  }

  //attach a vertex buffer to each faces
  var buffers = [];
  for (var i = 0; i < this.faces.length; i++) {
    var fverts = [];
    for (var j = 0; j < this.faces[i].length; j++)
      fverts.push(this.verts[this.faces[i][j]]);

    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(fverts), gl.STATIC_DRAW);
    buffers.push(buffer);
  }

  this.updateModel2World = function() {
    this.model2world = this.rotated2world.times(this.object2rotated).times(this.model2object);
    this.world2model = this.object2model.times(this.rotated2object).times(this.world2rotated);
  }

  this.renderFace = function(index) {
    var vPosition = gl.getAttribLocation(program, "vPosition");
    var colorLoc = gl.getUniformLocation(program, "color");
    var normalLoc = gl.getUniformLocation(program, "normal");
    var model2worldLoc = gl.getUniformLocation( program, "model2world" );
    var world2modelLoc = gl.getUniformLocation( program, "world2model" );

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[index]);
    gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);
    gl.uniform4fv(colorLoc, this.color.flatten());
    gl.uniform4fv(normalLoc, this.normals[index].flatten());
    gl.uniformMatrix4fv(model2worldLoc, false, this.model2world.flatten());
    gl.uniformMatrix4fv(world2modelLoc, false, this.world2model.flatten());
    gl.drawArrays(gl.TRIANGLE_FAN, 0, this.faces[index].length);
  }

  this.render = function() {
    //NO PAINTERS, just render all the faces in order
    for (var j=0; j<this.faces.length; j++) {
      this.renderFace(j);
    }
  }

  this.getFaces = function() {
    var faces = [];
    for (var i=0; i<this.faces.length; i++) {
      var face = {
        shape: this,
        index: i
      };
      faces.push(face);
    }
    return faces;
  }
}