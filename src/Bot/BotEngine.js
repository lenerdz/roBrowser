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
    var Context       = require('Core/Context');
    var DB            = require('DB/DBManager');
    var SkillId              = require('DB/Skills/SkillConst');
    var SkillTargetSelection = require('UI/Components/SkillTargetSelection/SkillTargetSelection');

    var _steps = [];
    var _interval;
    var currentStepIndex = 0;
    var avaliableMobNames = [];
    var targetGID = null;

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

        delta[0] += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(2 * Math.random()));
        delta[1] += (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(2 * Math.random()));

        console.log((new Date()).toLocaleTimeString(), ' delta: ' + delta + '.');

        var pkt = new PACKET.CZ.REQUEST_MOVE();

        glMatrix.vec2.add(pkt.dest, Session.Entity.position, delta);

        console.log((new Date()).toLocaleTimeString(), ' destination: ' + pkt.dest + '.');

        Network.sendPacket(pkt);
    }

    function attack() {
        var target = null;
        var distance = 15;
        var currentDistance;

        EntityManager.forEach(function(entity) {
            var entityPosition = [Math.floor(entity.position[0]),Math.floor(entity.position[1])];
            currentDistance = glMatrix.vec2.distance(Session.Entity.position, entityPosition);

            if (!entity.display || !entity.display.name) {
              entity.display.load = entity.display.TYPE.LOADING;

              var pkt = new PACKET.CZ.REQNAME();
              pkt.AID = entity.GID;
              Network.sendPacket(pkt);
            } else if (entity.objecttype === entity.constructor.TYPE_MOB && entity.life.hp !== 0 && currentDistance < distance && isAvailableTarget(entity)) {
                console.log((new Date()).toLocaleTimeString(), ' entity: ' + entity.GID + ', position: ' + entityPosition + ', type: ' + entity.objecttype + ', distance: ' + Math.floor(currentDistance) + '.');
                target = entity;
                distance = currentDistance;
            }
        });

        if (target) {
            targetGID = target.GID;
            if (target.display.name === 'Vocal') {
              SkillTargetSelection.onUseSkillToId(SkillId.AC_DOUBLE, 10, targetGID);
            } else {
              target.onFocus();
            }
            return true;
        } else {
          return false;
        }
    }

    function autoloot() {
      var target = null;
      var distance = 15;
      var currentDistance;


      EntityManager.forEach(function(entity) {
        console.log((new Date()).toLocaleTimeString(), ' item searching. entity type: ' + entity.objecttype + ', item type: ' + entity.constructor.TYPE_ITEM);
        console.log((new Date()).toLocaleTimeString(), entity);

        var entityPosition = [Math.floor(entity.position[0]),Math.floor(entity.position[1])];
        currentDistance = glMatrix.vec2.distance(Session.Entity.position, entityPosition);

        if (entity.objecttype === entity.constructor.TYPE_ITEM && currentDistance < distance && isAvailableItem(entity)) {
          console.log((new Date()).toLocaleTimeString(), ' item: ' + DB.getItemInfo(entity.ITID).identifiedDisplayName + ', position: ' + entityPosition + ', type: ' + entity.objecttype + ', distance: ' + Math.floor(currentDistance) + '.');
          target = entity;
          distance = currentDistance;
        }
      });

      if (target) {
        var pkt = new PACKET.CZ.ITEM_PICKUP();
        pkt.ITAID = target.GID;

        // Too far, walking to it
        if (glMatrix.vec2.distance(Session.Entity.position, target.position) > 2) {
          Session.moveAction = pkt;

          pkt = new PACKET.CZ.REQUEST_MOVE();
          pkt.dest = target.position;
          Network.sendPacket(pkt);

          return true;
        }

        Network.sendPacket(pkt);
        return true;
      } else {
        return false;
      }
    }

    function isAvailableTarget(target) {
      return (avaliableMobNames.length > 0) ? avaliableMobNames.indexOf(target.display.name) !== -1 : true;
    }

    function isAvailableItem() {
      return true;
    }

    function start(tick) {
        if (_interval) stop();

        _interval = setInterval(function() {
            Session.Entity.onAttack = onAttack;

            var target = null;
            if (targetGID && EntityManager.get(targetGID)) {
                target = EntityManager.get(targetGID);
                console.log((new Date()).toLocaleTimeString(), ' target distance: ' + glMatrix.vec2.distance(target.position, Session.Entity.position));
            }
            if (target && (glMatrix.vec2.distance(target.position, Session.Entity.position) < 14) && (target.life.hp !== 0)) {
                console.log((new Date()).toLocaleTimeString(), ' attack mob: ');
                target.onFocus();
                console.log(EntityManager.get(targetGID));
            } else {
                console.log((new Date()).toLocaleTimeString(), ' finding new target. ');
                targetGID = null;
                /*if (!autoloot())*/ if (!attack()) move();
            }

        }, tick);
    }

    function stop() {
        clearInterval(_interval);
        _interval = null;
        targetGID = null;
        Session.Entity.onPickup = null;
    }

    function addStep() {
        var step = [Math.floor(Session.Entity.position[0]), Math.floor(Session.Entity.position[1])];
        _steps.push(step);
        return step;
    }

    function getSteps() {
        return _steps;
    }

    function setSteps(steps) {
        return _steps = steps;
    }

    function deleteStep(index) {
        return _steps.splice(index, 1);
    }

    function addMob(name) {
      avaliableMobNames.push(name);
    }

    function getMobs() {
      return avaliableMobNames;
    }

    function onAttack(srcEntity) {
      targetGID = srcEntity.GID;
    }

    function deleteMob(index) {
      return avaliableMobNames.splice(index, 1);
    }

    function setCurrentStep(index) {
      currentStepIndex = index;
    }

    /**
     * Export
     */
    return {
        start: start,
        stop: stop,
        addStep: addStep,
        deleteStep: deleteStep,
        getSteps: getSteps,
        setSteps: setSteps,
        addMob: addMob,
        deleteMob: deleteMob,
        getMobs: getMobs,
        setCurrentStep: setCurrentStep
    };
});