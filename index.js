var app = require('express')();

var server = require('http').createServer(app);

var io = require('socket.io')(server);

app.get('/hello', function(req, res){
  res.status(200).send('<h1>Hello world</h1>');
});

app.get('/', function(req, res){
	var ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    console.log('Conexion express: '+ ip);
	res.sendFile(__dirname + '/index.html');
});

	

var room="1";
var rooms=io.sockets.in(room);
var sockets=[null,null,null];
var socketsLength=3;

io.on('connection', function(socket){
  console.log('Connection established on socket.io');
  var idClient=socketsLength;
  for (var i = 0; i < socketsLength; i++) {
	  if(sockets[i]==null){
		  sockets[i]=socket;
		  idClient=i;
		  break;
	  }
  }
  socket.join(room);
  socket.emit('CR_setId',idClient);
  
  socket.on('disconnect', function(){
    console.log('Connection closed on socket.io');
	sockets[sockets.indexOf(socket)]=null;

  });
		//Asteroids events
  socket.on('SS_createAst',function(data){
	  console.log("Asteroid created: ");
	  console.log(data);
	  rooms.emit('CR_createAst',data);
  });
  
  socket.on("SS_deleteAst",function(data){
	  console.log("Asteroid deleted: ");
	  console.log(data);
	  rooms.emit("CR_deleteAst",data);
  });
		//Shots events
  socket.on('SS_createShot',function(data){
	  console.log("Shot created: ");
	  console.log(data);
	  rooms.emit('CR_createShot',data);
  });
  
  socket.on("SS_deleteShot",function(data){
	  console.log("Shot deleted: ");
	  console.log(data);
	  rooms.emit("CR_deleteShot",data);
  });
		//possition update events
  socket.on('SS_setPos',function(data){
	  //console.log(data);
	  rooms.emit("CR_setPos",data);
  });
		//Client´s move update
  socket.on("CS_move",function(data){
	  console.log("Client moveing:");
	  console.log(data);
	  rooms.emit("SR_move",data);
  });
		//client´s parameters configuration
  socket.on("CS_reqConfig",function(data){
	  console.log("Requet client config");
	  rooms.emit("SR_reqConfig",data);
  });
  
  socket.on("SS_resConfig",function(data){
	  console.log("Response client config");
	  rooms.emit("CR_resConfig",data);
  });
  socket.on("SS_explosion",function(data){
	  console.log("Explosion produced:");
	  console.log(data);
	  rooms.emit("CR_explosion",data);
  });
  
});


server.listen(3000, function(){
  console.log('listening on *:3000');
});

