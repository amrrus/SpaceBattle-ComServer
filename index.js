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
            if(!rooms[room].hasServer()){
                rooms[room].initServer();
            }
            if(!rooms[room].hasPlayer(socket.id)){
                rooms[room].addPlayer(socket.id);
            }
            //socket.to(socket.id).emit("config", config);
            handlePlayerConnection(room, socket);      
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
    socket.on('update_player_death', emit.player.death);

    socket.on('disconnect', ()=>{
        console.log("Server disconnected");
        deleteRoom(room);
    }); 
}

function handlePlayerConnection(room, socket) {
    var emit = emitFunctions(room, socket);

    socket.on('move_player', emit.player.move);

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
                console.log("Asteroid created");
                socket.in(room).broadcast.emit("create_asteroid", data);
            },
            delete: function(data){
                console.log("Asteroid deleted");
                socket.in(room).broadcast.emit("delete_asteroid", data);                
            }
        },
        shot: {
            create: function (data) {
                console.log("Shot created");
                socket.in(room).broadcast.emit("create_shot", data);
            },
            delete: function (data) {
                console.log("Shot deleted");
                socket.in(room).broadcast.emit("delete_shot", data);
            }
        },
        explosion: {
            create: function(data){
                console.log("Explosion created");
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
                socket.in(server).volatile.emit("move_player", data);
            },
            lives: function(data){
                console.log("Lives updated:");
                socket.in(room).broadcast.emit("update_player_lives", data);
            },
            death: function(data){
                console.log("State player updated");
                socket.in(room).broadcast.emit("update_player_death", data);
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
        delete rooms[room];        
    }
}


server.listen(3000, function() {
    console.log('listening on *:3000');
});