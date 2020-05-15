"use strict";
var canvas = document.getElementById('gameCanvas');
var SCREEN_HEIGHT = 20; // number of Tetris blocks that fit on screen
var SCREEN_WIDTH = 10;
var xSize = canvas.width / SCREEN_WIDTH; // size of blocks
var ySize = canvas.height / SCREEN_HEIGHT;
    // blocks: each element represents a rotation of the piece (0, 90, 180, 270)
    //         each element is a 16 bit integer where the 16 bits represent
    //         a 4x4 set of blocks, e.g. j.blocks[0] = 0x44C0
    //
    //             0100 = 0x4 << 3 = 0x4000
    //             0100 = 0x4 << 2 = 0x0400
    //             1100 = 0xC << 1 = 0x00C0
    //             0000 = 0x0 << 0 = 0x0000
    //                               ------
    //                               0x44C0

// 0100 // 0x4
// 1110 // 0xE
// 1110 // 0xE

// 1100 // 0xC
// 1110 // 0xE
// 1100 // 0xC

// 1110 // 0xE
// 1110 // 0xE
// 0100 // 0x4

// 0110 // 0x6
// 1110 // 0xE
// 0110 // 0x6

class Block {
	constructor(rotations, color) {
		this.rotations = rotations;
		this.color = color;
	}
}
// 00001000
// 00001000
// 00001000
// 00001000
// 00001000
// 00001000
// 00001000
// 00001000

// 00000000
// 00000000
// 00000000
// 11111111
// 00000000
// 00000000
// 00000000
// 00000000

var block_long = new Block([0x0F00, 0x2222, 0x00F0, 0x4444], "cyan");
var block_j = new Block([0x44C0, 0x8E00, 0x6440, 0x0E20], "blue");
var block_l = new Block([0x4460, 0x0E80, 0xC440, 0x2E00], "orange");
var block_square = new Block([0xCC00, 0xCC00, 0xCC00, 0xCC00], "yellow");
var block_s = new Block([0x06C0, 0x8C40, 0x6C00, 0x4620], "green");
var block_t = new Block([0x0E40, 0x4C40, 0x4E00, 0x4640], "purple");
var block_z = new Block([0x0C60, 0x4C80, 0xC600, 0x2640], "red");
var block_colon = new Block([0x0500, 0x0202, 0x0050, 0x0404], "navy");
var block_tub = new Block([0x0252, 0x0252, 0x0252, 0x0252], "beige");
var block_blinker = new Block([0x0700, 0x2220, 0x0700, 0x2220], "cyan");
var block_bullet = new Block([0x04EE, 0x0CEC, 0x0EE4, 0x06E6], "gray");
var block_five = new Block([0x0525, 0x0525, 0x0525, 0x0525], "black");
var block_two = new Block([0x2080, 0x8020, 0x2080, 0x8020], "#BA17ED");
var block_six = new Block([0xAAA0, 0xE0E0, 0xAAA0, 0xE0E0], "navy");
var block_longlong = new Block([0x000000FF00000000n, 0x0808080808080808n, 0x00000000FF000000n, 0x1010101010101010n], "cyan");
var blocks = [block_long, block_j, block_l, block_square, block_s, block_t, block_z,
			  block_colon, block_tub, block_blinker, block_bullet, block_five, block_longlong, block_two, block_six];
var origPieces = [block_long, block_j, block_l, block_square, block_s, block_t, block_z];
var nextBlock, currBlock, heldBlock;
var holdAvailable = true;
var lockBlock = false;
var placedSquares = [];
var queue = [];
var block_x = 0; var block_y = 0;
var lastUpdate = new Date().getTime();

function iterateBlockCoords(block, func, ...args) {
	var arr = [];
	if (block < 0x10000) { // extended size?
		for (var row = 0; row < 4; row++) {
			for (var col = 0; col < 4; col++) {
				if (block & (1 << (col + 4 * row))) arr.push(func(col + block_x, row + block_y, args));
			}
		}
	} else {
		for (var row = 0; row < 8; row++) {
			for (var col = 0; col < 8; col++) {
				if (block & BigInt(2 ** (col + 8 * row))) arr.push(func(col + block_x, row + block_y, args));
			}
		}
	}
	return arr;
}

function iterateBlockCoordsNoBlockPos(block, func, ...args) {
	var arr = [];
	if (block < 0x10000) { // extended size?
		for (var row = 0; row < 4; row++) {
			for (var col = 0; col < 4; col++) {
				if (block & (1 << (col + 4 * row))) arr.push(func(col, row, args));
			}
		}
	} else {
		for (var row = 0; row < 8; row++) {
			for (var col = 0; col < 8; col++) {
				if (block & BigInt(2 ** (col + 8 * row))) arr.push(func(col, row, args));
			}
		}
	}
	return arr;
}

function isBlockAt(x, y) {
	for (let i = 0; i < placedSquares.length; i++) {
		if (placedSquares[i][0] === x && placedSquares[i][1] === y)
			return true;
	}
	return false;
}

function isPositionValid(x, y) {
	if (x >= 0 && x < SCREEN_WIDTH && y >= 0 && y < SCREEN_HEIGHT) {
		return !isBlockAt(x, y);
	}
	return false;
}
var rotation = 0;
var ctx = canvas.getContext('2d');
ctx.lineWidth = 1;
ctx.translate(0.5, 0.5);
document.addEventListener('keydown', keydown, false);

function keydown(event) {
	queue.push(event.keyCode);
}

function handleQueue(queue) {
	for (let i = 0; i < queue.length; i++) {
		switch(queue[i]) {
			case 13: // Enter
				if (holdAvailable) {
					holdAvailable = false;
					if (heldBlock) {
						let tempBlock = heldBlock;
						heldBlock = currBlock;
						currBlock = tempBlock;
					} else {
						heldBlock = currBlock;
						currBlock = nextBlock;
						chooseNextBlock();
						drawNextBlock();
					}
					drawHeldBlock();
					rotation = 0;
					block_x = 0;
					block_y = 0;
				}
				break;
			case 37: // Left
				block_x--;
				if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x))
					block_x++;
				break;
			case 38: // Up
				rotation = (rotation + 1) % 4;
				if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x))
					rotation = (rotation - 1) % 4;
				break;
			case 39: // Right
				block_x++;
				if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x))
					block_x--;
				break;
			case 40: // Down
				block_y++;
				if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x))
					block_y--;
				break;
		}
	}
}

function placeSquare(x, y, color) {
	placedSquares.push([x, y, color]);
}

function drawSquare(x, y, args) {
	let color = args[0];
	let context = args[1];
	context.fillStyle = color;
	context.fillRect(x * xSize, y * ySize, xSize, ySize);
	context.strokeRect(x * xSize, y * ySize, xSize, ySize);
}

function clearRow(row) {
	for (var i = 0; i < placedSquares.length; i++) {
		if (placedSquares[i][1] == row) {
			placedSquares.splice(i, 1);
			i--;
		} else if (placedSquares[i][1] < row) {
			placedSquares[i][1]++;
		}
	}
}

function clearRows() {
	var destroyRow;
	for (var row = 0; row < SCREEN_HEIGHT; row++) {
				destroyRow = true;
		for (var col = 0; col < SCREEN_WIDTH; col++) {
			if (!isBlockAt(col, row)) {
				destroyRow = false;
			}
		}
		if (destroyRow) {
			clearRow(row--);
		}
	}
}

function drawNextBlock() {
	let canvas = document.getElementById('nextCanvas');
	canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
	canvas.getContext('2d').strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
	iterateBlockCoordsNoBlockPos(nextBlock.rotations[0], drawSquare, nextBlock.color, canvas.getContext('2d'));
}

function drawHeldBlock() {
	let canvas = document.getElementById('holdCanvas');
	canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
	canvas.getContext('2d').strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
	if (heldBlock)
		iterateBlockCoordsNoBlockPos(heldBlock.rotations[0], drawSquare, heldBlock.color, canvas.getContext('2d'));
}

function loseGame() {
	origPieces = [block_long, block_j, block_l, block_square, block_s, block_t, block_z];
	let index = Math.floor(Math.random() * origPieces.length);
	currBlock = origPieces[index];
	origPieces.splice(index, 1);
	chooseNextBlock();
	drawNextBlock();
	heldBlock = null;
	holdAvailable = true;
	drawHeldBlock();
	placedSquares = [];
	queue = [];
	block_x = 0; block_y = 0;
	lastUpdate = new Date().getTime();
}

function chooseNextBlock() {
	if (origPieces.length) {
		let index = Math.floor(Math.random() * origPieces.length);
		nextBlock = origPieces[index];
		origPieces.splice(index, 1);
	} else {
		nextBlock = blocks[Math.floor(Math.random() * blocks.length)];
	}
}

function mainLoop() {
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
	iterateBlockCoords(currBlock.rotations[rotation], drawSquare, currBlock.color, ctx);
	for (let i = 0; i < placedSquares.length; i++) {
		drawSquare(placedSquares[i][0], placedSquares[i][1], [placedSquares[i][2], ctx]);
	}
	if (queue.length) {
		handleQueue(queue);
		queue = [];
	}
	clearRows();
	var nowUpdate = new Date().getTime();

	if (lockBlock) {
		holdAvailable = true;
		iterateBlockCoords(currBlock.rotations[rotation], placeSquare, currBlock.color);
		currBlock = nextBlock;
		chooseNextBlock();
		drawNextBlock();
		rotation = 0;
		block_x = 0;
		block_y = 0;
		if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x)) {
			loseGame();
		}
		lastUpdate = nowUpdate;
		lockBlock = false;
		requestAnimationFrame(mainLoop);
		return;
	}
	
	if (nowUpdate - lastUpdate > 1000) {
		block_y++;
		if (!iterateBlockCoords(currBlock.rotations[rotation], isPositionValid).every(x => x)) {
			block_y--;
			lockBlock = true;
		}
		lastUpdate = nowUpdate;
	}
	requestAnimationFrame(mainLoop);
}
let index = Math.floor(Math.random() * origPieces.length);
currBlock = origPieces[index];
origPieces.splice(index, 1);
chooseNextBlock();
drawNextBlock();
drawHeldBlock();
requestAnimationFrame(mainLoop);
