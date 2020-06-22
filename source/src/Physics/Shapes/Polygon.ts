///<reference path="./Shape.ts" />
class Polygon extends Shape {
    public points: Vector2[];
    public isUnrotated: boolean = true;
    private _polygonCenter: Vector2;
    private _areEdgeNormalsDirty = true;
    protected _originalPoints: Vector2[];

    public _edgeNormals: Vector2[];
    public get edgeNormals(){
        if (this._areEdgeNormalsDirty)
            this.buildEdgeNormals();
        return this._edgeNormals;
    }
    public isBox: boolean;

    constructor(points: Vector2[], isBox?: boolean){
        super();

        this.setPoints(points);
        this.isBox = isBox;
    }

    private buildEdgeNormals(){
        let totalEdges = this.isBox ? 2 : this.points.length;
        if (this._edgeNormals == null || this._edgeNormals.length != totalEdges)
            this._edgeNormals = new Array(totalEdges);

        let p2: Vector2;
        for (let i = 0; i < totalEdges; i ++){
            let p1 = this.points[i];
            if (i + 1 >= this.points.length)
                p2 = this.points[0];
            else
                p2 = this.points[i + 1];

            let perp = Vector2Ext.perpendicular(p1, p2);
            perp = Vector2.normalize(perp);
            this._edgeNormals[i] = perp;
        }
    }

    public setPoints(points: Vector2[]) {
        this.points = points;
        this.recalculateCenterAndEdgeNormals();

        this._originalPoints = [];
        for (let i = 0; i < this.points.length; i ++){
            this._originalPoints.push(this.points[i]);
        }
    }

    public collidesWithShape(other: Shape){
        let result = new CollisionResult();
        if (other instanceof Polygon){
            return ShapeCollisions.polygonToPolygon(this, other);
        }

        if (other instanceof Circle){
            result = ShapeCollisions.circleToPolygon(other, this);
            if (result){
                result.invertResult();
                return result;
            }

            return null;
        }

        throw new Error(`overlaps of Polygon to ${other} are not supported`);
    }

    public recalculateCenterAndEdgeNormals() {
        this._polygonCenter = Polygon.findPolygonCenter(this.points);
        this._areEdgeNormalsDirty = true;
    }

    public overlaps(other: Shape){
        let result: CollisionResult;
        if (other instanceof Polygon)
            return ShapeCollisions.polygonToPolygon(this, other);

        if (other instanceof Circle){
            result = ShapeCollisions.circleToPolygon(other, this);
            if (result){
                result.invertResult();
                return true;
            }

            return false;
        }

        throw new Error(`overlaps of Pologon to ${other} are not supported`);
    }

    public static findPolygonCenter(points: Vector2[]) {
        let x = 0, y = 0;

        for (let i = 0; i < points.length; i++) {
            x += points[i].x;
            y += points[i].y;
        }

        return new Vector2(x / points.length, y / points.length);
    }

    public static getClosestPointOnPolygonToPoint(points: Vector2[], point: Vector2): { closestPoint, distanceSquared, edgeNormal } {
        let distanceSquared = Number.MAX_VALUE;
        let edgeNormal = new Vector2(0, 0);
        let closestPoint = new Vector2(0, 0);

        let tempDistanceSquared;
        for (let i = 0; i < points.length; i++) {
            let j = i + 1;
            if (j == points.length)
                j = 0;

            let closest = ShapeCollisions.closestPointOnLine(points[i], points[j], point);
            tempDistanceSquared = Vector2.distanceSquared(point, closest);

            if (tempDistanceSquared < distanceSquared) {
                distanceSquared = tempDistanceSquared;
                closestPoint = closest;

                let line = Vector2.subtract(points[j], points[i]);
                edgeNormal.x = -line.y;
                edgeNormal.y = line.x;
            }
        }

        edgeNormal = Vector2.normalize(edgeNormal);

        return { closestPoint: closestPoint, distanceSquared: distanceSquared, edgeNormal: edgeNormal };
    }

    public pointCollidesWithShape(point: Vector2): CollisionResult {
        return ShapeCollisions.pointToPoly(point, this);
    }

    public containsPoint(point: Vector2) {
        point = Vector2.subtract(point, this.position);

        let isInside = false;
        for (let i = 0, j = this.points.length - 1; i < this.points.length; j = i++) {
            if (((this.points[i].y > point.y) != (this.points[j].y > point.y)) &&
                (point.x < (this.points[j].x - this.points[i].x) * (point.y - this.points[i].y) / (this.points[j].y - this.points[i].y) +
                    this.points[i].x)) {
                isInside = !isInside;
            }
        }

        return isInside;
    }

    /**
     * 建立一个对称的多边形(六边形，八角形，n角形)并返回点
     * @param vertCount 
     * @param radius 
     */
    public static buildSymmertricalPolygon(vertCount: number, radius: number) {
        let verts = new Array(vertCount);

        for (let i = 0; i < vertCount; i++) {
            let a = 2 * Math.PI * (i / vertCount);
            verts[i] = new Vector2(Math.cos(a), Math.sin(a) * radius);
        }

        return verts;
    }

    public recalculateBounds(collider: Collider) {
        this.center = collider.localOffset;

        if (collider.shouldColliderScaleAndRotationWithTransform){
            let hasUnitScale = true;
            let tempMat: Matrix2D;
            let combinedMatrix = Matrix2D.createTranslation(-this._polygonCenter.x, -this._polygonCenter.y);

            if (collider.entity.transform.scale != Vector2.one){
                tempMat = Matrix2D.createScale(collider.entity.transform.scale.x, collider.entity.transform.scale.y);
                combinedMatrix = Matrix2D.multiply(combinedMatrix, tempMat);

                hasUnitScale = false;
                let scaledOffset = Vector2.multiply(collider.localOffset, collider.entity.transform.scale);
                this.center = scaledOffset;
            }

            if (collider.entity.transform.rotation != 0){
                tempMat = Matrix2D.createRotation(collider.entity.transform.rotation);
                combinedMatrix = Matrix2D.multiply(combinedMatrix, tempMat);

                let offsetAngle = Math.atan2(collider.localOffset.y, collider.localOffset.x) * MathHelper.Rad2Deg;
                let offsetLength = hasUnitScale ? collider._localOffsetLength : (Vector2.multiply(collider.localOffset, collider.entity.transform.scale)).length();
                this.center = MathHelper.pointOnCirlce(Vector2.zero, offsetLength, collider.entity.transform.rotationDegrees + offsetAngle);
            }

            tempMat = Matrix2D.createTranslation(this._polygonCenter.x, this._polygonCenter.y);
            combinedMatrix = Matrix2D.multiply(combinedMatrix, tempMat);

            Vector2Ext.transform(this._originalPoints, combinedMatrix, this.points);
            this.isUnrotated = collider.entity.transform.rotation == 0;

            if (collider._isRotationDirty)
                this._areEdgeNormalsDirty = true;
        }

        this.position = Vector2.add(collider.entity.transform.position, this.center);
        this.bounds = Rectangle.rectEncompassingPoints(this.points);
        this.bounds.location = Vector2.add(this.bounds.location, this.position);
    }
}