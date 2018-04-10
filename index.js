var _ = require('lodash');
var Room = require('./classes').Room;

var app = require('express')();
var server = require('http').createServer(app);

var io = require('socket.io')(server, {
    pingInterval: 300,
    pingTimeout: 20000
});

app.get('/hello', function(req, res) {
    res.status(200).send('<h1>Hello world</h1>');
});


var rooms = {};
io.on('connection', (socket)=>{    
    socket.on('room', (data) => {
        if(typeof(data) === "string"){
            try{
                data = JSON.parse(data);                
            } catch (err){
                console.log(err);
                return socket.disconnect();
            }
        }
        var room = data["room"];
        var isServer = data.isServer || false;
        var config = data.config || "";

        console.log("Room: "+room);
        room = "room";  
        if (!(room in rooms)){
            rooms[room] = new Room(); 
        }

        socket.join(room);       

        // si es una instancia de servidor y la sala no tiene ya asignado uno
        if(isServer && !rooms[room].hasServer()){ 
            rooms[room].setServer(socket.id);
            rooms[room].setConfig(config);
            handleServerConnection(room, socket);       
        
        // si es un jugador
        } else if (!isServer){
            //if(!rooms[room].hasServer()){
            //    rooms[room].initServer(room);
            //}
            if(!rooms[room].hasPlayer(socket.id)){
                rooms[room].addPlayer(socket.id);
            }
            //socket.to(socket.id).emit("config", config);
            handlePlayerConnection(room, socket);   
            console.log("condicion:"+(!(rooms[room].getPlayers().includes(null))));
            if(!(rooms[room].getPlayers().includes(null))){
                startSecuence(room,socket);
            }
        } else {
            // no se ha podido conectar
            socket.disconnect();
        }
    });
});

function handleServerConnection(room, socket){   
    var emit = emitFunctions(room, socket);
    
    socket.on('create_asteroid', emit.asteroid.create);
    socket.on('delete_asteroid', emit.asteroid.delete);
    socket.on('create_shot', emit.shot.create);
    socket.on('delete_shot', emit.shot.delete);
    socket.on('create_explosion', emit.explosion.create);
    socket.on('update_player_position', emit.player.update);
    socket.on('update_player_lives', emit.player.lives);
    socket.on('update_player_shots', emit.player.shots);
    socket.on('end_game', emit.game.end);

    socket.on('disconnect', ()=>{
        console.log("Server disconnected");
        deleteRoom(room);
    }); 
}

function handlePlayerConnection(room, socket) {
    var emit = emitFunctions(room, socket);

    socket.on('move_player', emit.player.move);
    socket.on('player_shooting', emit.player.shooting);

    socket.on('disconnect', () => {
        console.log("Client disconnected");
        var playerPosition = rooms[room].getPlayerPosition(socket.id); 
        rooms[room].removePlayer(playerPosition);
    }); 
}

function emitFunctions (room, socket) {
    return {
        asteroid: {
            create: function(data){     
                //console.log("Asteroid created");
                socket.in(room).broadcast.emit("create_asteroid", data);
            },
            delete: function(data){
                //console.log("Asteroid deleted");
                socket.in(room).broadcast.emit("delete_asteroid", data);                
            }
        },
        shot: {
            create: function (data) {
                //console.log("Shot created");
                socket.in(room).broadcast.emit("create_shot", data);
            },
            delete: function (data) {
                //console.log("Shot deleted");
                socket.in(room).broadcast.emit("delete_shot", data);
            }
        },
        explosion: {
            create: function(data){
                //console.log("Explosion created");
                socket.in(room).broadcast.emit("create_explosion", data);
            }
        },
        player: {
            update: function(data){                
                socket.in(room).broadcast.emit("update_player_position", data);
            },
            move: function(data){
                var server = rooms[room].getServer();
                var playerPosition = rooms[room].getPlayerPosition(socket.id);                
                data = [data];
                data.push(playerPosition);
                socket.in(server).emit("move_player", data);
            },
            lives: function(data){
                //console.log("Lives updated:");
                socket.in(room).broadcast.emit("update_player_lives", data);
            },
            shooting: function(data){
                console.log("player shooting: "+data);
                var server = rooms[room].getServer();
                var playerPosition = rooms[room].getPlayerPosition(socket.id);                
                data = [data];
                data.push(playerPosition);
                socket.in(server).emit("player_shooting", data);
            },
            shots: function(data){
                console.log("Update player shots"+data);
                socket.in(room).broadcast.emit("update_player_shots", data);
            }
        },
        game:{
            start:function(data){
                console.log("Starting game.");
                socket.in(room).broadcast.emit("start_game", data);
            },
            end: function(data){
                console.log("Ending game:");
                var server = rooms[room].getServer();
                var loser = data["loser"];
                rooms[room].getPlayers().forEach(
                    function (id, index, arr){
                        console.log("id:"+id);
                        var msg = {"loser":loser == index};
                        socket.in(id).emit("end_game", msg);
                    }
                );
                //rooms[room].stopServer();
                deleteRoom(room);
            }
        },
        rooms:{
            create:function(data){
                
            },
            delete:function(data){
                
            },
            update:function(){
                
            },
            created:function(){
                
            },
            deleted:function(){
                
            },
            add_player:function(){
                
            }
        }
    };
}

function deleteRoom(room){
    if (room in rooms) {
        if (room in io.sockets.adapter.rooms){
            for(var clientId in io.sockets.adapter.rooms[room].sockets){
                io.sockets.connected[clientId].disconnect();
            }
        }
        
        setTimeout(delete rooms[room],5000);
    }
}

function startSecuence(room,socket){
    console.log("start secuence");
    var server = rooms[room].getServer();
                   
    io.sockets.in(room).emit("start_game", {});
    io.sockets.in(room).emit("countdown", 3);
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 2)    },1000);
    setTimeout(function () {   rooms[room].initServer(room)                },2000); 
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 1)    },2000);
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 0)    },3000);
}

server.listen(3000, function() {
    console.log('listening on *:3000');
});