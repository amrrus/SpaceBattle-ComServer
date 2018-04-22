var _ = require('lodash');
var exec = require('child_process').exec;
    
class Room {

    constructor(bp = null, tp = null, serv = null) {
        this.config = null;    
        this.players = [bp, tp];
        this.server = serv;
        this.pid=-1;
    }

    getPlayers() {
        return this.players;
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

    addPlayer(id, pos = null) { // pos (position) => null/0/1
        var index = -1;
        if (_.isUndefined(this.getPlayers()[pos])){
            index = _.indexOf(this.getPlayers(), null);
        }

        if (_.isNull(this.getPlayers()[index])) {
            this.players[index] = id;
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