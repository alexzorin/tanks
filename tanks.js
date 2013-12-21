var Q = Quintus({
	development: true
}).include("Sprites, Scenes, Input, 2D, Anim").setup({
	maximize: true
}).controls();

Q.component("TankControls", {
	added: function() {
		var p = this.entity.p;
		if(!p.stepDistance) {
			p.stepDistance = 32;
		}
		if(!p.stepDelay) {
			p.stepDelay = 0.2;
		}
		p.stepWait = 0;
		this.entity.on("step", this, "step");
		this.entity.on("hit", this, "collision");
	},
	collision: function(col) {
		console.log(col);
	},
	step: function(dt) {
		var p = this.entity.p, tank = this.entity, moved = false;

		p.stepWait -= dt;
		if(p.stepping) {
			p.x += p.diffX * dt / p.stepDelay;
			p.y += p.diffY * dt / p.stepDelay;
		}

		// Traverse the hull on left and right input
		if(Q.inputs["left"]) {
			tank.rotate(Q.inputs["down"] ? tank.getTraverse() : -tank.getTraverse());
		} else if(Q.inputs["right"]) {
			tank.rotate(Q.inputs["down"] ? -tank.getTraverse() : tank.getTraverse());
		}

		// Traverse the turret based on mouse
		if(tank.aim.x !== 0 && tank.aim.y !== 0) {
			var x = Q.canvasToStageX(tank.aim.x, Q.stage(0));
			var y = Q.canvasToStageY(tank.aim.y, Q.stage(0));
			var deltaX = x - p.x, deltaY = -(y - p.y);
			var deg = normalizeAngle(Math.atan2(deltaX, deltaY) * (180 / Math.PI));
			var gunDeg = normalizeAngle(normalizeAngle(deg - p.angle) - tank.gun.p.angle);
			if(gunDeg <= 5) {

			} else if(gunDeg >= 180) {
				tank.rotateGun(tank.getTraverse() * -1);
			} else {
				tank.rotateGun(tank.getTraverse());
			}
		}
		// console.log("HULL ANGLE: " + p.angle);
		// console.log("TURRET ANGLE: " + player.gun.p.angle);
		// console.log("COMBINED ANGLE: " + normalizeAngle(p.angle + player.gun.p.angle));
		// console.log("AIM ANGLE: " + gunDeg);

		// Don't accept input if waiting
		if(p.stepWait > 0) { return; }

		if(p.stepping) {
			p.x = p.destX;
			p.y = p.destY;
		}
		p.stepping = false;

		p.diffX = 0;
		p.diffY = 0;

		if(Q.inputs["up"]) {
			if(p.lastDir === 0) {
				p.vx = 0;
				p.vy = 0;
			}
			p.lastDir = 1;
			tank.accelerate();
			p.diffY = (Math.cos(p.angle * (Math.PI/180)) * -p.stepDistance) * p.vy;
			p.diffX = (Math.sin(p.angle * (Math.PI/180)) * p.stepDistance) * p.vx;
		} else if(Q.inputs["down"]) {
			if(p.lastDir === 1) {
				p.vx = 0;
				p.vy = 0;
			}
			p.lastDir = 0;
			tank.accelerate();
			p.diffY = (Math.cos(p.angle * (Math.PI/180)) * p.stepDistance) * p.vy;
			p.diffX = (Math.sin(p.angle * (Math.PI/180)) * -p.stepDistance) * p.vx;
		} else {
			// reset velocity if we're not pushing up or down
			p.vx = 0;
			p.vy = 0;
		}

		if(p.diffY || p.diffX ) {
			p.stepping = true;
			p.origX = p.x;
			p.origY = p.y;
			p.destX = p.x + p.diffX;
			p.destY = p.y + p.diffY;
			p.stepWait = p.stepDelay;
		}
	}
});

function normalizeAngle(deg) {
	if(deg <= 0) {
		return 360 + deg;
	} else if(deg > 360) {
		return deg - 360;
	} else {
		return deg;
	}
}

Q.Sprite.extend("PlayerTank", {
	init: function(p) {
		this._super({
			asset: "tank_base.png",
			collisionMask: Q.SPRITE_NONE,
			type: Q.SPRITE_PLAYER
		});
		this.aim = {x:0, y:0};
		this.add("2d, TankControls");
	},
	rotate: function(deg) {
		// Rotate the tank
		this.p.angle = normalizeAngle(this.p.angle + deg);
		// and the turret needs to rotate with the hull too
		// this.rotateGun(deg);
		// and apply speed penalty for hull traverse
		this.decellerate();
	},
	setGun: function(gun) {
		this.gun = gun;
	},
	rotateGun: function(deg) {
		if(typeof(this.gun) !== "undefined" && this.gun !== null) {
			this.gun.rotate(deg);
		}
	},
	getTopSpeed: function() {
		return 2;
	},
	getCurrentSpeed: function() {
		return this.p.vx;
	},
	getTraverse: function() {
		return 1 + ((this.getCurrentSpeed() / this.getTopSpeed()) / 2);
	},
	getTurretTraverse: function() {
		return this.getTraverse() * 1.5;
	},
	accelerate: function() {
		this.p.vx = this.p.vy = Math.min(this.getTopSpeed(), this.p.vx + 0.075);
	},
	decellerate: function() {
		this.p.vx = this.p.vy = Math.max(0, this.p.vx - (0.025 * (this.getCurrentSpeed() / this.getTopSpeed())));
	},
	setGunAim: function(x,y) {
		this.aim = {x: x, y: y};
	}
});

Q.Sprite.extend("TankGun", {
	init: function(p) {
		this._super({
			asset: "gun.png",
			collisionMask: Q.SPRITE_NONE,
			type: Q.SPRITE_PLAYER,
			cy: 55
		});
	},
	rotate: function(deg) {
		this.p.angle = normalizeAngle(this.p.angle + deg);
		// console.log("gun rotated to " + this.p.angle + " relative to hull");
	}
});

Q.scene("battle", function(stage) {
	stage.insert(new Q.Repeater({
		asset: "tiles.png"
	}));
	var player = stage.insert(new Q.PlayerTank());
	var playerGun = stage.insert(new Q.TankGun(), player);
	player.setGun(playerGun);
	stage.add("viewport");
	stage.follow(player);
	Q.el.addEventListener("mousemove", function(e) {
		var x = e.offsetX || e.layerX, y = e.offsetY || e.layerY;
		player.setGunAim(x, y);
	});
});

Q.load(["tank_base.png", "gun.png", "tiles.png"], function() {
	Q.gravityY = 0;
	Q.debug = true;
	Q.input.keyboardControls({
		87: "up", 65:"left", 83: "down",  68: "right"
	});
	Q.stageScene("battle");
});
