/**
 * Bot/BotEngine.js
 *
 * Bot Engine
 *
 * This file is part of ROBrowser, Ragnarok Online in the Web Browser (http://www.robrowser.com/).
 *
 */

define(function( require )
{
    'use strict';


    // Load dependencies
    var glMatrix      = require('Utils/gl-matrix');
    var Session       = require('Engine/SessionStorage');
    var EntityManager = require('Renderer/EntityManager');
    var Network       = require('Network/NetworkManager');
    var PACKET        = require('Network/PacketStructure');

    var _steps = [];

    var _interval;
    var currentStepIndex;

    function sign(x) { return x > 0 ? 1 : x < 0 ? -1 : 0; }

    function move() {
        console.log((new Date()).toLocaleTimeString(), ' current step index: ' + currentStepIndex + '.');

        if (glMatrix.vec2.distance(_steps[currentStepIndex], Session.Entity.position) < 5) {
            currentStepIndex++;
            currentStepIndex = currentStepIndex % _steps.length;
            console.log((new Date()).toLocaleTimeString(), ' current step index was changed: ' + currentStepIndex + '.');
        }

        console.log((new Date()).toLocaleTimeString(), ' current step destination: ' + _steps[currentStepIndex] + '.');

        var delta = [];

        glMatrix.vec2.sub(delta, _steps[currentStepIndex], Session.Entity.position);
        console.log((new Date()).toLocaleTimeString(), ' current position: ' + Math.floor(Session.Entity.position[0]) + ',' + Math.floor(Session.Entity.position[1]) + '.');

        delta[0] = (Math.abs(delta[0]) > 10) ? sign(delta[0])*10 : delta[0];
        delta[1] = (Math.abs(delta[1]) > 10) ? sign(delta[1])*10 : delta[1];

        console.log((new Date()).toLocaleTimeString(), ' delta: ' + delta + '.');

        var pkt = new PACKET.CZ.REQUEST_MOVE();

        glMatrix.vec2.add(pkt.dest, Session.Entity.position, delta);

        console.log((new Date()).toLocaleTimeString(), ' destination: ' + pkt.dest + '.');

        Network.sendPacket(pkt);
    }

    var targetGID = null;

    function attack() {
        var target = null;
        var distance = 20;
        var currentDistance;

        EntityManager.forEach(function(entity) {
            var entityPosition = [Math.floor(entity.position[0]),Math.floor(entity.position[1])];
            currentDistance = glMatrix.vec2.distance(Session.Entity.position, entityPosition);

            console.log((new Date()).toLocaleTimeString(), ' entity hp: ' + entity.life.hp);

            if (entity.objecttype === entity.constructor.TYPE_MOB && entity.life.hp !== 0 && currentDistance < distance) {
                console.log((new Date()).toLocaleTimeString(), ' entity: ' + entity.GID + ', position: ' + entityPosition + ', type: ' + entity.objecttype + ', distance: ' + Math.floor(currentDistance) + '.');
                target = entity;
                distance = currentDistance;
            }
        });

        if (target) {
            targetGID = target.GID;
            target.onFocus();
        }
    }

    function start(tick) {
        if (_interval) stop();

        currentStepIndex = 0;

        _interval = setInterval(function() {
            //console.log((new Date()).toLocaleTimeString(), ' bot is active.');
            //move();
            var target = null;
            if (targetGID && EntityManager.get(targetGID)) {
                target = EntityManager.get(targetGID);
                console.log((new Date()).toLocaleTimeString(), ' target distance: ' + glMatrix.vec2.distance(target.position, Session.Entity.position));
            }
            if (target && (glMatrix.vec2.distance(target.position, Session.Entity.position) < 21) && (target.life.hp !== 0)) {
                console.log((new Date()).toLocaleTimeString(), ' attack mob: ');
                console.log(EntityManager.get(targetGID));
            } else {
                console.log((new Date()).toLocaleTimeString(), ' finding new target. ');
                targetGID = null;
                attack();
            }

        }, tick);
    }

    function stop() {
        clearInterval(_interval);
        _interval = null;
        targetGID = null;
    }

    function addStep() {
        var step = [Math.floor(Session.Entity.position[0]), Math.floor(Session.Entity.position[1])];
        _steps.push(step);
        return step;
    }

    function getSteps() {
        return _steps;
    }

    function deleteStep(index) {
        return _steps.splice(index, 1);
    }

    /**
     * Export
     */
    return {
        start: start,
        stop: stop,
        addStep: addStep,
        deleteStep: deleteStep,
        getSteps: getSteps
    };
});