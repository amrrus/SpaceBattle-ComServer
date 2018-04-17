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
var users = {};
io.on('connection', (socket)=>{    
    console.log('Connected');
    
    users[socket.id] = socket.id + "-nickname"; // TODO: use nickname
    console.log(users);

    socket.on('get_rooms', ()=>{
        console.log("Get rooms");
        socket.emit('get_rooms', {rooms: _.keys(rooms)});
    });
    socket.on('join_room', (data)=>{
        [err, data] = parseJSON(data);
        if (err) return emitError(socket, 'join_room', 'Error parsing JSON');// TODO: handle error on client       

        // room key must be in data object. Room must exist. The room cannot be full of players.
        if ( ('room' in data) && (data.room in rooms) && rooms[data.room].addPlayer(socket.id) !== -1){
            console.log(`User ${users[socket.id]} entered to room ${data.room}`);        
            socket.join(data.room);       

            startSequence(data.room);            
        }else{
            return emitError(socket, 'join_room', "Error at entering room");// TODO: handle error on client
        }
        
    });
    socket.on('create_room', () => {        
        
        var room = users[socket.id];                

        console.log("Create room: " + room);        

        if (!(room in rooms)){
            rooms[room] = new Room();
        }else{
            return emitError(socket, 'create_room_error', 'Room already exists');// TODO: handle error on client
        }

        socket.join(room);
        rooms[room].addPlayer(socket.id);    
    });

    socket.on('delete_room', () => {
        delete rooms[users[socket.id]];
    });

    socket.on('join_room_server', (data)=>{
        console.log("Server connected");

        [err, data] = parseJSON(data);
        if (err) {
            console.log(err);
            return emitError(socket, 'join_room_server', 'Error parsing JSON');// TODO: handle error on server
        }

        socket.join(data.room);
        rooms[data.room].setServer(socket.id);
        rooms[data.room].setConfig(data.config);
        handleServerGameConnections(data.room, socket);       

    });

    socket.on('disconnect', ()=>{
        console.log("Socket disconnected: "+ socket.id);

        if( socket.id in users){
            deleteRoom(users[socket.id]);
            delete users[socket.id];
        }
    })
});

function handleServerGameConnections(room, socket){   
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
}

function handlePlayerGameConnections(room, socket) {
    var emit = emitFunctions(room, socket);

    socket.on('move_player', emit.player.move);
    socket.on('player_shooting', emit.player.shooting);
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
                //console.log("player shooting: "+data);
                var server = rooms[room].getServer();
                var playerPosition = rooms[room].getPlayerPosition(socket.id);                
                data = [data];
                data.push(playerPosition);
                socket.in(server).emit("player_shooting", data);
            },
            shots: function(data){
                //console.log("Update player shots"+data);
                socket.in(room).broadcast.emit("update_player_shots", data);
            }
        },
        game:{
            start:function(data){
                console.log("Starting game");
                socket.in(room).broadcast.emit("start_game", data);
            },
            end: function(data){
                console.log("Ending game");
                var server = rooms[room].getServer();
                var loser = data["loser"];
                rooms[room].getPlayers().forEach(
                    function (id, index, arr){
                        console.log("id:"+id);
                        var msg = {"loser":loser == index};
                        socket.in(id).emit("end_game", msg);
                    }
                );
                io.sockets.connected[server].disconnect();
                rooms[room].stopServer();
                deleteRoom(room);
            }
        },
        rooms:{
            create:function(data){
                var nameRoom = data["name"];
                var nickName = data["nickname"];
                //warnning concurrency and asynchronous
                indexRooms++;
                rooms[indexRooms] = new Room();
                socket.emit("created_room",indexRooms);
                
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
                removeGameListeners(io.sockets.connected[clientId]);
                io.sockets.connected[clientId].leave(room);
            }
        }
        
        delete rooms[room];
    }
}

function removeGameListeners(socket){
    var events = ['move_player', 'player_shooting'];
    events.forEach((event, index, array)=>{
        socket.removeListener(event, ()=>{});
    });
}

function startSequence(room){
    console.log("Start sequence");

    _.forEach(io.sockets.adapter.rooms[room].sockets, (value, socketId)=>{
        handlePlayerGameConnections(room, io.sockets.connected[socketId]);
    });

    rooms[room].initServer(room)
    io.sockets.in(room).emit("start_game", {});
    io.sockets.in(room).emit("countdown", 3);
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 2)    },1000);    
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 1)    },2000);
    setTimeout(function () {   io.sockets.in(room).emit("countdown", 0)    },3000);
}

function parseJSON(data){
    if (typeof (data) !== 'string') {
        data = JSON.stringify(data);
    }
    
    try {        
        return [null, JSON.parse(data)];
    }catch(err){
        return [err, undefined];
    }
}

function emitError(socket, event, msg){
    return socket.in(socket.id).emit(event, {error: msg});
}

server.listen(3000, function() {
    console.log('listening on *:3000');
});