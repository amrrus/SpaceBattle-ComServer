var _ = require('lodash');
var Room = require('./classes').Room;

var app = require('express')();
var server = require('http').createServer(app);

var io = require('socket.io')(server, {
    pingInterval: 300,
    pingTimeout: 20000
});

app.get('*', function(req, res) {
    res.status(200).send('<h1>Servidor de SpaceBattle</h1>');
});


var rooms = {};
var users = {};
io.on('connection', (socket)=>{    
    console.log('Connected');
    
    socket.on('check_nick', (data)=>{
        var res = false;
        if (users[socket.id] == data || !(Object.values(users)).includes(data)){
            users[socket.id] = data;
            res=true;
        }
        socket.emit('check_nick_result', {"result":res,"send_nick":data});

    });


    console.log(`Usuarios conectados: ${JSON.stringify(users)}`);

    socket.on('get_rooms', ()=>{
        console.log("Get rooms");
        socket.emit('get_rooms', {rooms: _.keys(_.omitBy(rooms, (roomInstance, roomName)=>{return roomInstance.hasServer()}))});
    });
    socket.on('join_room', (data)=>{
        [err, data] = parseJSON(data);
        if (err) return emitError(socket, 'join_room', 'Error parsing JSON');// TODO: handle error on client       

        // room key must be in data object. Room must exist. The room cannot be full of players.
        if ( ('room' in data) && ('nickName' in data) && (data.room in rooms) && rooms[data.room].addPlayer(socket.id,data.nickName) !== -1){
            console.log(`User ${users[socket.id]} entered to room ${data.room}`); 
            socket.join(data.room);       
			
            startSequence(data.room);            
        }else{
            return emitError(socket, 'join_room', "Error at entering room");// TODO: handle error on client
        }
        
    });
    socket.on('create_room', (data) => {        
        [err, data] = parseJSON(data);
        if (err) return emitError(socket, 'create_room', 'Error parsing JSON');// TODO: handle error on client       
		
		console.log(`User ${data.nickName} created room.`); 
        var room = users[socket.id] + "-room";                

        console.log("Create room: " + room);        

        if (!(room in rooms)){
            rooms[room] = new Room();
            rooms[room].setConfig(getDefaultConfig());
        }else{
            return emitError(socket, 'create_room_error', 'Room already exists');// TODO: handle error on client
        }
		socket.join(room);
		rooms[room].addPlayer(socket.id,data.nickName);  
    });

    socket.on('delete_room', () => {
        delete rooms[users[socket.id]+"-room"];
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

        let parsedParams = data.config.split(",").reduce((result, param)=>{
            [paramName, paramValue] = param.split(':');
            return Object.assign(result, { [paramName]: paramValue});
        }, {});

        rooms[data.room].setConfig(parsedParams);	
        handleServerGameConnections(data.room, socket);       

    });

    socket.on('disconnect', ()=>{
        console.log("Socket disconnected: "+ socket.id);

        if( socket.id in users){
            var room = users[socket.id]+"-room";

            if (room in rooms){
                var msg = {"loser": rooms[room].getPlayerPosition(socket.id)};
                socket.in(room).emit("end_game", msg);

                deleteRoom(room);
            }
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
	socket.on('send_config',emit.game.config);

    socket.removeAllListeners('disconnect');
    socket.on('disconnect', () => {
        console.log("Server disconnected: " + socket.id);

        rooms[room].stopServer();
    })
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
			config:function(data){
                console.log("game configuration");
                socket.in(room).broadcast.emit("handle_config", data);
            },
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
                rooms[room].stopServer();
                io.sockets.connected[server].disconnect();
                deleteRoom(room);
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

                if (rooms[room].getServer() == clientId){
                    io.sockets.connected[clientId].disconnect();
                }
            }
        }
        
        delete rooms[room];
    }
}

function removeGameListeners(socket){    
    var events = ['move_player', 'player_shooting'];
    events.forEach((event, index, array)=>{
        socket.removeAllListeners(event);
    });
}

function startSequence(room){
    console.log("Start sequence");  

    
    io.sockets.in(room).emit("start_game", {"bottom_player_name": rooms[room].getPlayersName()[0],
											"top_player_name":rooms[room].getPlayersName()[1],
											"con": Object.entries(rooms[room].getConfig()).map(([pName, pValue])=>{return `${pName}:${pValue}`;}).join(",")}
							);
	console.log("countdown started");  
    
	setTimeout(function () {
		io.sockets.in(room).emit("show_game_screen", {});
		console.log("countdown 3");
		io.sockets.in(room).emit("countdown", 3);
	},3000);
	
    setTimeout(function () {
        console.log("countdown 2");
        if(room in rooms)
		    rooms[room].initServer(room);
		io.sockets.in(room).emit("countdown", 2);
	},4000);
	
    setTimeout(function () {   
		console.log("countdown 1");
		io.sockets.in(room).emit("countdown", 1);
	},5000);
	
    setTimeout(function () {
		console.log("countdown 0");
        io.sockets.in(room).emit("countdown", 0); 
        
        if (room in io.sockets.adapter.rooms){
            _.forEach(io.sockets.adapter.rooms[room].sockets, (value, socketId) => {
                handlePlayerGameConnections(room, io.sockets.connected[socketId]);
            })
        };    
    },6000);


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

function getDefaultConfig() {
    return {
        TIME_SHOT_REGENERATION_INTERVAL: 0.3,
        TIME_BETWEEN_SHOTS: 0.1
    };
}

server.listen(3000, function() {
    console.log('listening on *:3000');
});