export default class StereoCamera {
    constructor(Convergence, EyeSeparation, AspectRatio, FOV, NearClippingDistance, FarClippingDistance) {
        this.mConvergence = Convergence;
        this.mEyeSeparation = EyeSeparation;
        this.mAspectRatio = AspectRatio;
        this.mFOV = FOV * Math.PI / 180.0;
        this.mNear = NearClippingDistance;
        this.mFar = FarClippingDistance;
    }

    applyLeftFrustum() {
        let top = this.mNear * Math.tan(this.mFOV / 2);
        let bottom = -top;

        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;

        let left = -b * this.mNear / this.mConvergence;
        let right = c * this.mNear / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top, this.mNear, this.mFar);
        const modelView = m4.translation(this.mEyeSeparation / 2, 0.0, 0.0);

        return { projection, modelView };
    }

    applyRightFrustum() {
        let top = this.mNear * Math.tan(this.mFOV / 2);
        let bottom = -top;

        let a = this.mAspectRatio * Math.tan(this.mFOV / 2) * this.mConvergence;
        let b = a - this.mEyeSeparation / 2;
        let c = a + this.mEyeSeparation / 2;

        let left = -c * this.mNear / this.mConvergence;
        let right = b * this.mNear / this.mConvergence;

        const projection = m4.frustum(left, right, bottom, top, this.mNear, this.mFar);
        const modelView = m4.translation(-this.mEyeSeparation / 2, 0.0, 0.0);

        return { projection, modelView };
    }
}