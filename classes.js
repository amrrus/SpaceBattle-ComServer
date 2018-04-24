var _ = require('lodash');
var exec = require('child_process').exec;
    
class Room {

    constructor(bp = null, tp = null, serv = null) {
        this.config = "";    
        this.players = [bp, tp];
		this.playersName = ["bot","top"];
        this.server = serv;
        this.pid=-1;
    }

    getPlayers() {
        return this.players;
    }
	
	getPlayersName(){
		return this.playersName;
	}

    getServer() {
        return this.server;
    }

    setServer(server) {
        this.server = server;
    }

    hasServer() {
        return !_.isNull(this.getServer());
    }

    hasPlayer(idPlayer) {
        return _.includes(this.getPlayers(), idPlayer);
    }

    addPlayer(id, nickName= "...", pos = null) { // pos (position) => null/0/1
        var index = -1;
        if (_.isUndefined(this.getPlayers()[pos])){
            index = _.indexOf(this.getPlayers(), null);
        }

        if (_.isNull(this.getPlayers()[index])) {
            this.players[index] = id;
			this.playersName[index]=nickName;
            return index;
        } else {
            return -1;
        }
    }

    removePlayer(pos){
        this.players[pos] = null;
    }

    getPlayerPosition(id) {
        return _.indexOf(this.getPlayers(), id);
    }

	getConfig(){
		return this.config;
	}
	
    setConfig(config) {
        this.config = config;
    }

    initServer(room){
        this.serverExecution = exec('java -jar "physicsServer.jar" '+room, (err, stdout, stderr) => {
        });
        this.pid=this.serverExecution._handle['pid'];
    }
    stopServer(){
        console.log("Stop server");        
        //this.serverExecution.stdin.pause();
        this.serverExecution.kill('SIGKILL');
    }
    
}

module.exports.Room = Room;