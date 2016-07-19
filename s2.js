var bignum = require('bignum');

function Point(x, y, z) {
    this.components = [x, y, z];
    this.x = x;
    this.y = y;
    this.z = z;
}

Point.prototype.abs = function() {
    return new Point(Math.abs(this.x), Math.abs(this.y), Math.abs(this.z));
}

Point.prototype.largest_abs_component = function() {
    var temp = this.abs();
    if (temp.components[0] > temp.components[1]) {
        if (temp.components[0] > temp[2])
            return 0;
        else
            return 2;
    }
    else {
        if (temp.components[1] > temp.components[2])
            return 1;
        else
            return 2;
    }
}



function valid_face_xyz_to_uv(face, point) {
    //assert p.dot_prod(face_uv_to_xyz(face, 0, 0)) > 0
    if (face == 0)
        return [point.components[1] / point.components[0], point.components[2] / point.components[0]];
    else if (face == 1)
        return [-point.components[0] / point.components[1], point.components[2] / point.components[1]];
    else if (face == 2)
        return [-point.components[0] / point.components[2], -point.components[1] / point.components[2]];
    else if (face == 3)
        return [point.components[2] / point.components[0], point.components[1] / point.components[0]];
    else if (face == 4)
        return [point.components[2] / point.components[1], -point.components[0] / point.components[1]];
    else
        return [-point.components[1] / point.components[2], -point.components[0] / point.components[2]];
}

function xyz_to_face_uv(point) {
    var face = point.largest_abs_component();
    if (point.components[face] < 0)
        face += 3;
    var uv = valid_face_xyz_to_uv(face, point);
    return [face].concat(uv);
}

function toRadians(degrees) {
    return degrees * Math.PI / 180;
}


function LatLng(lat, lng) {
    //in radians

    this.lat = lat;
    this.lng = lng;
}

LatLng.prototype.to_point = function() {
    var phi = this.lat;
    var theta = this.lng;
    var cosphi = Math.cos(phi);
    return new Point(Math.cos(theta) * cosphi, Math.sin(theta) * cosphi, Math.sin(phi));
};

LatLng.from_degrees = function(lat, lng) {
    return new LatLng(toRadians(lat), toRadians(lng));
};



function CellId(cellId) {
    if (cellId.lt(0))
        cellId = cellId.add(bignum('10000000000000000', 16));

    this.cellId = cellId.mod(bignum('ffffffffffffffff', 16));
}

const LINEAR_PROJECTION = 0;
const TAN_PROJECTION = 1;
const QUADRATIC_PROJECTION = 2;

const PROJECTION = QUADRATIC_PROJECTION;

const LOOKUP_BITS = 4;
const SWAP_MASK = 0x01;
const INVERT_MASK = 0x02;

const MAX_LEVEL = 30;
const POS_BITS = 2 * MAX_LEVEL + 1;
const MAX_SIZE = 1 << MAX_LEVEL;

const POS_TO_IJ = [[0, 1, 3, 2],
             [0, 2, 3, 1],
             [3, 2, 0, 1],
             [3, 1, 0, 2]];
const POS_TO_ORIENTATION = [SWAP_MASK, 0, 0, INVERT_MASK | SWAP_MASK];
var LOOKUP_POS = [];
LOOKUP_POS.length =  (1 << (2 * LOOKUP_BITS + 2));
var LOOKUP_IJ = [];
LOOKUP_IJ.length =  (1 << (2 * LOOKUP_BITS + 2));

function _init_lookup_cell(level, i, j, orig_orientation, pos, orientation) {
    if (level == LOOKUP_BITS) {
        var ij = (i << LOOKUP_BITS) + j;
        LOOKUP_POS[(ij << 2) + orig_orientation] = (pos << 2) + orientation;
        LOOKUP_IJ[(pos << 2) + orig_orientation] = (ij << 2) + orientation;
    }
    else {
        level = level + 1;
        i <<= 1;
        j <<= 1;
        pos <<= 2;
        var r = POS_TO_IJ[orientation];
        for (var index = 0; index < 4; index++)// in range(4):
            _init_lookup_cell(
                level, i + (r[index] >> 1),
                j + (r[index] & 1), orig_orientation,
                pos + index, orientation ^ POS_TO_ORIENTATION[index]
            );
    }
}

_init_lookup_cell(0, 0, 0, 0, 0, 0)
_init_lookup_cell(0, 0, 0, SWAP_MASK, 0, SWAP_MASK)
_init_lookup_cell(0, 0, 0, INVERT_MASK, 0, INVERT_MASK)
_init_lookup_cell(0, 0, 0, SWAP_MASK | INVERT_MASK, 0, SWAP_MASK | INVERT_MASK)

uv_to_st = function(u) {
    if (PROJECTION == LINEAR_PROJECTION)
        return 0.5 * (u + 1)
    else if (PROJECTION == TAN_PROJECTION)
        return (2 * (1.0 / Math.PI)) * (Math.atan(u) * Math.PI / 4.0)
    else if (PROJECTION == QUADRATIC_PROJECTION) {
        if (u >= 0)
            return 0.5 * Math.sqrt(1 + 3 * u);
        else
            return 1 - 0.5 * Math.sqrt(1 - 3 * u);
    }
    else
        throw 'unknown projection type';
};

st_to_ij = function(s) {
    return Math.max(0, Math.min(MAX_SIZE - 1, Math.floor(MAX_SIZE * s)));
};

CellId.prototype.id = function() {
    return this.cellId;
};

CellId.prototype.lsb = function() {
    if (this.cellId.eq(0))
        return bignum(0);

    var lsb = bignum(1);
    do {
        if (!this.cellId.and(lsb).eq(0))
            return lsb;

        lsb = lsb.shiftLeft(1);
    } while(true);

    //return this.cellId & (-this.cellId);
};

CellId.prototype.prev = function() {
    return new CellId(this.cellId.sub(this.lsb().shiftLeft(1)));
    //return new CellId(this.cellId - this.lsb() << 1);
};

CellId.prototype.next = function() {
    return new CellId(this.cellId.add(this.lsb().shiftLeft(1)));
    //return new CellId(this.cellId + this.lsb() << 1);
};

CellId.prototype.lsb_for_level = function(level) {
    return 1 << (2 * (MAX_LEVEL - level));
};

CellId.prototype.lsb_shift_for_level = function(level) {
    return (2 * (MAX_LEVEL - level));
};

CellId.prototype.parent = function(level) {
    //assert level >= 0
    //assert level <= self.level()
    var new_lsb = this.lsb_for_level(level);
    var new_lsb_shift = this.lsb_shift_for_level(level);
    return new CellId(this.cellId.shiftRight(new_lsb_shift).shiftLeft(new_lsb_shift).or(new_lsb));//return new CellId((this.cellId & (-new_lsb)) | new_lsb);
};
 

CellId.from_lat_lng = function(latLng) {
    return CellId.from_point(latLng.to_point());
};

CellId.from_point = function(point) {
    var fuv = xyz_to_face_uv(point);
    var face = fuv[0];
    var u = fuv[1];
    var v = fuv[2];
    var i = st_to_ij(uv_to_st(u));
    var j = st_to_ij(uv_to_st(v));
    return CellId.from_face_ij(face, i, j);
};

CellId.from_face_ij = function(face, i, j) {
    var n = bignum(face).shiftLeft(POS_BITS - 1);//face << (POS_BITS - 1);
    var bits = face & SWAP_MASK;

    for (var k = 7; k > -1; k--) {// in range(7, -1, -1):
        var mask = (1 << LOOKUP_BITS) - 1;
        bits += (((i >> (k * LOOKUP_BITS)) & mask) << (LOOKUP_BITS + 2));
        bits += (((j >> (k * LOOKUP_BITS)) & mask) << 2);
        bits = LOOKUP_POS[bits];
        n = n.or(bignum(bits).shiftRight(2).shiftLeft(k * 2 * LOOKUP_BITS));//n |= (bits >> 2) << (k * 2 * LOOKUP_BITS);
        bits &= (SWAP_MASK | INVERT_MASK);
    }

    return new CellId(n.mul(2).add(1));
};

exports.LatLng = LatLng;
exports.CellId = CellId;
