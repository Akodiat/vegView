import {
    Color,
    LinearSRGBColorSpace,
    MathUtils,
    Texture,
    PlaneGeometry,
    Mesh,
    MeshBasicMaterial,
    DoubleSide,
    CanvasTexture,
    LinearFilter,
    SpriteMaterial,
    Sprite,
    Line,
    LineBasicMaterial,
    Vector3,
    BufferGeometry
} from "three";

const defaultLegendParameters = {
    layout: "vertical",
    position: new Vector3(),
    dimensions: {
        width: 0.5,
        height: 3
    }
};

const defaultLabelParameters = {
    fontsize: 24,
    fontface: "Arial",
    title: "",
    ticks: 0,
    decimal: 2,
    notation: "standard"
};

const defaultBackgroundColor = {
    r: 255,
    g: 100,
    b: 100,
    a: 0.8
};
const defaultBorderColor = {
    r: 255,
    g: 0,
    b: 0,
    a: 1.0
};
const defaultBorderThickness = 4;

class Lut {

    constructor(colormap, count = 32) {

        this.isLut = true;

        this.lut = [];
        this.map = [];
        this.n = 0;
        this.minV = 0;
        this.maxV = 1;

        this.setColorMap(colormap, count);

    }

    set(value) {

        if (value.isLut === true) {

            this.copy(value);

        }

        return this;

    }

    setMin(min) {

        this.minV = min;

        return this;

    }

    setMax(max) {

        this.maxV = max;

        return this;

    }

    setColorMap(colormap, count = 32) {

        this.map = ColorMapKeywords[colormap] || ColorMapKeywords.rainbow;
        this.n = count;

        const step = 1.0 / this.n;
        const minColor = new Color();
        const maxColor = new Color();

        this.lut.length = 0;

        // sample at 0

        this.lut.push(new Color(this.map[0][1]));

        // sample at 1/n, ..., (n-1)/n

        for (let i = 1; i < count; i++) {

            const alpha = i * step;

            for (let j = 0; j < this.map.length - 1; j++) {

                if (alpha > this.map[j][0] && alpha <= this.map[j + 1][0]) {

                    const min = this.map[j][0];
                    const max = this.map[j + 1][0];

                    minColor.setHex(this.map[j][1], LinearSRGBColorSpace);
                    maxColor.setHex(this.map[j + 1][1], LinearSRGBColorSpace);

                    const color = new Color().lerpColors(minColor, maxColor, (alpha - min) / (max - min));

                    this.lut.push(color);

                }

            }

        }

        // sample at 1

        this.lut.push(new Color(this.map[this.map.length - 1][1]));

        return this;

    }

    copy(lut) {

        this.lut = lut.lut;
        this.map = lut.map;
        this.n = lut.n;
        this.minV = lut.minV;
        this.maxV = lut.maxV;

        return this;

    }

    getColor(alpha) {

        alpha = MathUtils.clamp(alpha, this.minV, this.maxV);

        alpha = (alpha - this.minV) / (this.maxV - this.minV);

        const colorPosition = Math.round(alpha * this.n);

        return this.lut[colorPosition];

    }

    addColorMap(name, arrayOfColors) {

        ColorMapKeywords[name] = arrayOfColors;

        return this;

    }

    createCanvas() {

        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = this.n;

        this.updateCanvas(canvas);

        return canvas;

    }

    updateCanvas(canvas) {

        const ctx = canvas.getContext("2d", {
            alpha: false
        });

        const imageData = ctx.getImageData(0, 0, 1, this.n);

        const data = imageData.data;

        let k = 0;

        const step = 1.0 / this.n;

        const minColor = new Color();
        const maxColor = new Color();
        const finalColor = new Color();

        for (let i = 1; i >= 0; i -= step) {

            for (let j = this.map.length - 1; j >= 0; j--) {

                if (i < this.map[j][0] && i >= this.map[j - 1][0]) {

                    const min = this.map[j - 1][0];
                    const max = this.map[j][0];

                    minColor.setHex(this.map[j - 1][1], LinearSRGBColorSpace);
                    maxColor.setHex(this.map[j][1], LinearSRGBColorSpace);

                    finalColor.lerpColors(minColor, maxColor, (i - min) / (max - min));

                    data[k * 4] = Math.round(finalColor.r * 255);
                    data[k * 4 + 1] = Math.round(finalColor.g * 255);
                    data[k * 4 + 2] = Math.round(finalColor.b * 255);
                    data[k * 4 + 3] = 255;

                    k += 1;

                }

            }

        }

        ctx.putImageData(imageData, 0, 0);

        return canvas;

    }

    setLegendOn(parameters) {

        parameters = parameters || defaultLegendParameters;

        this.legend = {};

        this.legend.layout = parameters.layout || defaultLegendParameters.layout;

        this.legend.position = parameters.position || defaultLegendParameters.position;

        this.legend.dimensions = parameters.dimensions || defaultLegendParameters.dimensions;

        const canvas = this.createCanvas();

        // Why was this added?
        //document.body.appendChild( canvas );

        this.legend.canvas = canvas;

        this.legend.texture = new Texture(canvas);
        this.legend.texture.needsUpdate = true;

        this.legend.legendGeometry = new PlaneGeometry(this.legend.dimensions.width, this.legend.dimensions.height);
        this.legend.legendMaterial = new MeshBasicMaterial({
            map: this.legend.texture,
            side: DoubleSide
        });

        this.legend.mesh = new Mesh(this.legend.legendGeometry, this.legend.legendMaterial);

        if (this.legend.layout == "horizontal") {

            this.legend.mesh.rotation.z = -90 * (Math.PI / 180);

        }

        this.legend.mesh.position.copy(this.legend.position);

        return this.legend.mesh;

    }

    setLegendOff() {

        this.legend = null;

        return this.legend;

    }

    setLegendLayout(layout) {

        if (!this.legend) {

            return false;

        }

        if (this.legend.layout == layout) {

            return false;

        }

        if (layout != "horizontal" && layout != "vertical") {

            return false;

        }

        this.layout = layout;

        if (layout == "horizontal") {

            this.legend.mesh.rotation.z = 90 * (Math.PI / 180);

        }

        if (layout == "vertical") {

            this.legend.mesh.rotation.z = -90 * (Math.PI / 180);

        }

        return this.legend.mesh;

    }

    setLegendPosition(position) {

        if (position.isVector3) {

            this.legend.position.copy(position);

        } else {

            this.legend.position.set(position.x, position.y, position.z);

        }

        return this.legend;

    }

    setLegendLabels(parameters, callback, render) {

        if (!this.legend) {

            return false;

        }

        if (typeof parameters === "function") {

            callback = parameters;
            parameters = undefined;

        }

        parameters = parameters || defaultLabelParameters;
        this.legend.labels = {};

        this.legend.labels.fontsize = parameters.fontsize || defaultLabelParameters.fontsize;
        this.legend.labels.fontface = parameters.fontface || defaultLabelParameters.fontface;
        this.legend.labels.title = parameters.title || defaultLabelParameters.title;
        this.legend.labels.ticks = parameters.ticks || defaultLabelParameters.ticks;
        this.legend.labels.decimal = parameters.decimal || defaultLabelParameters.decimal;
        this.legend.labels.notation = parameters.notation || defaultLabelParameters.notation;


        // eslint-disable-next-line no-undef
        let wrapper = MathJax.tex2svg(`\\text{${this.legend.labels.title}}`, {em: 32, ex: 16, display: false});
        let output = {svg: "", img: ""};
        let mjOut = wrapper.getElementsByTagName("svg")[0];
        output.svg = mjOut.outerHTML;
        var image = new Image();
        image.src = "data:image/svg+xml;base64," + window.btoa(unescape(encodeURIComponent(output.svg)));

        let spriteTitle = new Sprite();

        image.onload = ()=>{
            const scaleFactor = 4;
            const canvasTitle = document.createElement("canvas");
            canvasTitle.height = scaleFactor * image.naturalHeight;
            canvasTitle.width = scaleFactor * image.naturalWidth;
            const contextTitle = canvasTitle.getContext("2d");
            contextTitle.drawImage(image, 0, 0,
                image.width,
                image.height,
                0, 0,
                scaleFactor * image.width,
                scaleFactor * image.height
            );
            output.img = canvasTitle.toDataURL("image/png");

            const txtTitle = new CanvasTexture(canvasTitle);
            txtTitle.minFilter = LinearFilter;

            spriteTitle.material = new SpriteMaterial({
                map: txtTitle
            });
            spriteTitle.scale.set(
                image.width/(image.height*scaleFactor),
                1/scaleFactor,
                1
            );

            if (this.legend.layout == "vertical") {
                spriteTitle.position.set(
                    this.legend.position.x,
                    this.legend.position.y + (this.legend.dimensions.height * 0.5) + spriteTitle.scale.y,
                    this.legend.position.z
                );
            }

            if (this.legend.layout == "horizontal") {
                spriteTitle.position.set(
                    this.legend.position.x,
                    this.legend.position.y + this.legend.dimensions.width,
                    this.legend.position.z);
            }

            if (render !== undefined) {
                render();
            }
        };

        let ticks, lines;
        let topPositionX, topPositionY, bottomPositionX, bottomPositionY;

        if (this.legend.labels.ticks > 0) {

            ticks = {};
            lines = {};

            if (this.legend.layout == "vertical") {

                topPositionY = this.legend.position.y + (this.legend.dimensions.height * 0.36);
                bottomPositionY = this.legend.position.y - (this.legend.dimensions.height * 0.61);

            }

            if (this.legend.layout == "horizontal") {

                topPositionX = this.legend.position.x + (this.legend.dimensions.height * 0.75);
                bottomPositionX = this.legend.position.x - (this.legend.dimensions.width * 1.2);

            }

            for (let i = 0; i < this.legend.labels.ticks; i++) {

                let value = (this.maxV - this.minV) / (this.legend.labels.ticks - 1) * i + this.minV;

                if (callback) {

                    value = callback(value);

                } else {

                    if (this.legend.labels.notation == "scientific") {

                        value = value.toExponential(this.legend.labels.decimal);

                    } else {

                        value = value.toFixed(this.legend.labels.decimal);

                    }

                }

                const canvasTick = document.createElement("canvas");
                const contextTick = canvasTick.getContext("2d");

                contextTick.font = "Normal " + this.legend.labels.fontsize + "px " + this.legend.labels.fontface;

                contextTick.fillStyle = "rgba(" + defaultBackgroundColor.r + "," + defaultBackgroundColor.g + "," + defaultBackgroundColor.b + "," + defaultBackgroundColor.a + ")";

                contextTick.strokeStyle = "rgba(" + defaultBorderColor.r + "," + defaultBorderColor.g + "," + defaultBorderColor.b + "," + defaultBorderColor.a + ")";

                contextTick.lineWidth = defaultBorderThickness;

                contextTick.fillStyle = "rgba( 0, 0, 0, 1.0 )";

                contextTick.fillText(value.toString(), defaultBorderThickness, this.legend.labels.fontsize + defaultBorderThickness);

                const txtTick = new CanvasTexture(canvasTick);
                txtTick.minFilter = LinearFilter;

                const spriteMaterialTick = new SpriteMaterial({
                    map: txtTick
                });

                const spriteTick = new Sprite(spriteMaterialTick);

                spriteTick.scale.set(2, 1, 1.0);

                if (this.legend.layout == "vertical") {

                    const position = bottomPositionY + (topPositionY - bottomPositionY) * ((value - this.minV) / (this.maxV - this.minV));

                    spriteTick.position.set(this.legend.position.x + (this.legend.dimensions.width * 2.7), position, this.legend.position.z);

                }

                if (this.legend.layout == "horizontal") {

                    const position = bottomPositionX + (topPositionX - bottomPositionX) * ((value - this.minV) / (this.maxV - this.minV));

                    let offset;

                    if (this.legend.labels.ticks > 5) {

                        if (i % 2 === 0) {

                            offset = 1.7;

                        } else {

                            offset = 2.1;

                        }

                    } else {

                        offset = 1.7;

                    }

                    spriteTick.position.set(position, this.legend.position.y - this.legend.dimensions.width * offset, this.legend.position.z);

                }

                const material = new LineBasicMaterial({
                    color: 0x000000,
                    linewidth: 2
                });

                const points = [];


                if (this.legend.layout == "vertical") {

                    const linePosition = (this.legend.position.y - (this.legend.dimensions.height * 0.5) + 0.01) + (this.legend.dimensions.height) * ((value - this.minV) / (this.maxV - this.minV) * 0.99);

                    points.push(new Vector3(this.legend.position.x + this.legend.dimensions.width * 0.55, linePosition, this.legend.position.z));

                    points.push(new Vector3(this.legend.position.x + this.legend.dimensions.width * 0.7, linePosition, this.legend.position.z));

                }

                if (this.legend.layout == "horizontal") {

                    const linePosition = (this.legend.position.x - (this.legend.dimensions.height * 0.5) + 0.01) + (this.legend.dimensions.height) * ((value - this.minV) / (this.maxV - this.minV) * 0.99);

                    points.push(new Vector3(linePosition, this.legend.position.y - this.legend.dimensions.width * 0.55, this.legend.position.z));

                    points.push(new Vector3(linePosition, this.legend.position.y - this.legend.dimensions.width * 0.7, this.legend.position.z));

                }

                const geometry = new BufferGeometry().setFromPoints(points);

                const line = new Line(geometry, material);

                lines[i] = line;
                ticks[i] = spriteTick;

            }

        }

        return {
            "title": spriteTitle,
            "ticks": ticks,
            "lines": lines
        };

    }

}

const ColorMapKeywords = {

    "blackbody" : [ [ 0.0, 0x000000 ], [ 0.2, 0x780000 ], [ 0.5, 0xE63200 ], [ 0.8, 0xFFFF00 ],  [ 1.0, 0xFFFFFF ] ],
    "grayscale" : [ [ 0.0, 0x000000 ], [ 0.2, 0x404040 ], [ 0.5, 0x7F7F80 ], [ 0.8, 0xBFBFBF ],  [ 1.0, 0xFFFFFF ] ],
    "viridis":	[ [ 0.0, 0x440154 ], [ 0.25, 0x414487 ], [ 0.5, 0x2a788e ], [ 0.75, 0x22a884 ],  [ 1.0, 0x7ad151 ] ],
    "plasma":	[ [ 0.0, 0x0d0887 ], [ 0.25, 0x6a00a8 ], [ 0.5, 0xb12a90 ], [ 0.75, 0xe16462 ],  [ 1.0, 0xfca636 ] ],
    "inferno":	[ [ 0.0, 0x000004 ], [ 0.25, 0x420a68 ], [ 0.5, 0x932667 ], [ 0.75, 0xdd513a ],  [ 1.0, 0xfca50a ] ],
    "magma":	[ [ 0.0, 0x000004 ], [ 0.25, 0x3b0f70 ], [ 0.5, 0x8c2981 ], [ 0.75, 0xde4968 ],  [ 1.0, 0xfe9f6d ] ],
    "cividis":	[ [ 0.0, 0x00224e ], [ 0.25, 0x35456c ], [ 0.5, 0x666970 ], [ 0.75, 0x948e77 ],  [ 1.0, 0xc8b866 ] ],
    "Greys":	[ [ 0.0, 0xffffff ], [ 0.25, 0xe2e2e2 ], [ 0.5, 0xb5b5b5 ], [ 0.75, 0x7a7a7a ],  [ 1.0, 0x404040 ] ],
    "Purples":	[ [ 0.0, 0xfcfbfd ], [ 0.25, 0xe2e2ef ], [ 0.5, 0xb6b6d8 ], [ 0.75, 0x8683bd ],  [ 1.0, 0x61409b ] ],
    "Blues":	[ [ 0.0, 0xf7fbff ], [ 0.25, 0xd0e1f2 ], [ 0.5, 0x94c4df ], [ 0.75, 0x4a98c9 ],  [ 1.0, 0x1764ab ] ],
    "Greens":	[ [ 0.0, 0xf7fcf5 ], [ 0.25, 0xd3eecd ], [ 0.5, 0x98d594 ], [ 0.75, 0x4bb062 ],  [ 1.0, 0x157f3b ] ],
    "Oranges":	[ [ 0.0, 0xfff5eb ], [ 0.25, 0xfdd9b4 ], [ 0.5, 0xfda762 ], [ 0.75, 0xf3701b ],  [ 1.0, 0xc54102 ] ],
    "Reds":	[ [ 0.0, 0xfff5f0 ], [ 0.25, 0xfdcab5 ], [ 0.5, 0xfc8a6a ], [ 0.75, 0xf14432 ],  [ 1.0, 0xbc141a ] ],
    "YlOrBr":	[ [ 0.0, 0xffffe5 ], [ 0.25, 0xfeeba2 ], [ 0.5, 0xfebb47 ], [ 0.75, 0xf07818 ],  [ 1.0, 0xb84203 ] ],
    "YlOrRd":	[ [ 0.0, 0xffffcc ], [ 0.25, 0xfee187 ], [ 0.5, 0xfeab49 ], [ 0.75, 0xfc5b2e ],  [ 1.0, 0xd41020 ] ],
    "OrRd":	[ [ 0.0, 0xfff7ec ], [ 0.25, 0xfddcaf ], [ 0.5, 0xfdb27b ], [ 0.75, 0xf26d4b ],  [ 1.0, 0xc91d13 ] ],
    "PuRd":	[ [ 0.0, 0xf7f4f9 ], [ 0.25, 0xdcc9e2 ], [ 0.5, 0xcd8bc2 ], [ 0.75, 0xe53592 ],  [ 1.0, 0xb80b4e ] ],
    "RdPu":	[ [ 0.0, 0xfff7f3 ], [ 0.25, 0xfcd0cc ], [ 0.5, 0xf994b1 ], [ 0.75, 0xe23e99 ],  [ 1.0, 0x99017b ] ],
    "BuPu":	[ [ 0.0, 0xf7fcfd ], [ 0.25, 0xccddec ], [ 0.5, 0x9ab4d6 ], [ 0.75, 0x8c74b5 ],  [ 1.0, 0x852d90 ] ],
    "GnBu":	[ [ 0.0, 0xf7fcf0 ], [ 0.25, 0xd4eece ], [ 0.5, 0x9fdab8 ], [ 0.75, 0x57b8d0 ],  [ 1.0, 0x1d7eb7 ] ],
    "PuBu":	[ [ 0.0, 0xfff7fb ], [ 0.25, 0xdbdaeb ], [ 0.5, 0x9cb9d9 ], [ 0.75, 0x4295c3 ],  [ 1.0, 0x0567a2 ] ],
    "YlGnBu":	[ [ 0.0, 0xffffd9 ], [ 0.25, 0xd6efb3 ], [ 0.5, 0x73c8bd ], [ 0.75, 0x2498c1 ],  [ 1.0, 0x234da0 ] ],
    "PuBuGn":	[ [ 0.0, 0xfff7fb ], [ 0.25, 0xdbd8ea ], [ 0.5, 0x99b9d9 ], [ 0.75, 0x4095c3 ],  [ 1.0, 0x027976 ] ],
    "BuGn":	[ [ 0.0, 0xf7fcfd ], [ 0.25, 0xd6f0ee ], [ 0.5, 0x8fd4c2 ], [ 0.75, 0x48b27f ],  [ 1.0, 0x157f3b ] ],
    "YlGn":	[ [ 0.0, 0xffffe5 ], [ 0.25, 0xe5f5ac ], [ 0.5, 0xa2d88a ], [ 0.75, 0x4cb063 ],  [ 1.0, 0x15793e ] ],
    "binary":	[ [ 0.0, 0xffffff ], [ 0.25, 0xcccccc ], [ 0.5, 0x999999 ], [ 0.75, 0x666666 ],  [ 1.0, 0x333333 ] ],
    "gist_yarg":	[ [ 0.0, 0xffffff ], [ 0.25, 0xcccccc ], [ 0.5, 0x999999 ], [ 0.75, 0x666666 ],  [ 1.0, 0x333333 ] ],
    "gist_gray":	[ [ 0.0, 0x000000 ], [ 0.25, 0x333333 ], [ 0.5, 0x666666 ], [ 0.75, 0x999999 ],  [ 1.0, 0xcccccc ] ],
    "gray":	[ [ 0.0, 0x000000 ], [ 0.25, 0x333333 ], [ 0.5, 0x666666 ], [ 0.75, 0x999999 ],  [ 1.0, 0xcccccc ] ],
    "bone":	[ [ 0.0, 0x000000 ], [ 0.25, 0x2d2d3e ], [ 0.5, 0x595c79 ], [ 0.75, 0x869aa6 ],  [ 1.0, 0xb9d2d2 ] ],
    "pink":	[ [ 0.0, 0x1e0000 ], [ 0.25, 0x915d5d ], [ 0.5, 0xc68b84 ], [ 0.75, 0xdac6a1 ],  [ 1.0, 0xededc6 ] ],
    "spring":	[ [ 0.0, 0xff00ff ], [ 0.25, 0xff33cc ], [ 0.5, 0xff6699 ], [ 0.75, 0xff9966 ],  [ 1.0, 0xffcc33 ] ],
    "summer":	[ [ 0.0, 0x008066 ], [ 0.25, 0x339966 ], [ 0.5, 0x66b266 ], [ 0.75, 0x99cc66 ],  [ 1.0, 0xcce666 ] ],
    "autumn":	[ [ 0.0, 0xff0000 ], [ 0.25, 0xff3300 ], [ 0.5, 0xff6600 ], [ 0.75, 0xff9900 ],  [ 1.0, 0xffcc00 ] ],
    "winter":	[ [ 0.0, 0x0000ff ], [ 0.25, 0x0033e6 ], [ 0.5, 0x0066cc ], [ 0.75, 0x0099b2 ],  [ 1.0, 0x00cc99 ] ],
    "cool":	[ [ 0.0, 0x00ffff ], [ 0.25, 0x33ccff ], [ 0.5, 0x6699ff ], [ 0.75, 0x9966ff ],  [ 1.0, 0xcc33ff ] ],
    "Wistia":	[ [ 0.0, 0xe4ff7a ], [ 0.25, 0xfaed2d ], [ 0.5, 0xffce0a ], [ 0.75, 0xffb100 ],  [ 1.0, 0xfe9900 ] ],
    "hot":	[ [ 0.0, 0x0b0000 ], [ 0.25, 0x900000 ], [ 0.5, 0xff1700 ], [ 0.75, 0xff9d00 ],  [ 1.0, 0xffff36 ] ],
    "afmhot":	[ [ 0.0, 0x000000 ], [ 0.25, 0x660000 ], [ 0.5, 0xcc4d00 ], [ 0.75, 0xffb233 ],  [ 1.0, 0xffff99 ] ],
    "gist_heat":	[ [ 0.0, 0x000000 ], [ 0.25, 0x4d0000 ], [ 0.5, 0x990000 ], [ 0.75, 0xe53300 ],  [ 1.0, 0xff9933 ] ],
    "copper":	[ [ 0.0, 0x000000 ], [ 0.25, 0x3f2819 ], [ 0.5, 0x7e5033 ], [ 0.75, 0xbd784c ],  [ 1.0, 0xfc9f65 ] ],
    "PiYG":	[ [ 0.0, 0x8e0152 ], [ 0.25, 0xde77ae ], [ 0.5, 0xfde0ef ], [ 0.75, 0xe6f5d0 ],  [ 1.0, 0x7fbc41 ] ],
    "PRGn":	[ [ 0.0, 0x40004b ], [ 0.25, 0x9970ab ], [ 0.5, 0xe7d4e8 ], [ 0.75, 0xd9f0d3 ],  [ 1.0, 0x5aae61 ] ],
    "BrBG":	[ [ 0.0, 0x543005 ], [ 0.25, 0xbf812d ], [ 0.5, 0xf6e8c3 ], [ 0.75, 0xc7eae5 ],  [ 1.0, 0x35978f ] ],
    "PuOr":	[ [ 0.0, 0x7f3b08 ], [ 0.25, 0xe08214 ], [ 0.5, 0xfee0b6 ], [ 0.75, 0xd8daeb ],  [ 1.0, 0x8073ac ] ],
    "RdGy":	[ [ 0.0, 0x67001f ], [ 0.25, 0xd6604d ], [ 0.5, 0xfddbc7 ], [ 0.75, 0xe0e0e0 ],  [ 1.0, 0x878787 ] ],
    "RdBu":	[ [ 0.0, 0x67001f ], [ 0.25, 0xd6604d ], [ 0.5, 0xfddbc7 ], [ 0.75, 0xd1e5f0 ],  [ 1.0, 0x4393c3 ] ],
    "RdYlBu":	[ [ 0.0, 0xa50026 ], [ 0.25, 0xf46d43 ], [ 0.5, 0xfee090 ], [ 0.75, 0xe0f3f8 ],  [ 1.0, 0x74add1 ] ],
    "RdYlGn":	[ [ 0.0, 0xa50026 ], [ 0.25, 0xf46d43 ], [ 0.5, 0xfee08b ], [ 0.75, 0xd9ef8b ],  [ 1.0, 0x66bd63 ] ],
    "Spectral":	[ [ 0.0, 0x9e0142 ], [ 0.25, 0xf46d43 ], [ 0.5, 0xfee08b ], [ 0.75, 0xe6f598 ],  [ 1.0, 0x66c2a5 ] ],
    "cooltowarm": [ [ 0.0, 0x3C4EC2 ], [ 0.2, 0x9BBCFF ], [ 0.5, 0xDCDCDC ], [ 0.8, 0xF6A385 ],  [ 1.0, 0xB40426 ] ],
    "coolwarm":	[ [ 0.0, 0x3b4cc0 ], [ 0.25, 0x7b9ff9 ], [ 0.5, 0xc0d4f5 ], [ 0.75, 0xf2cbb7 ],  [ 1.0, 0xee8468 ] ],
    "bwr":	[ [ 0.0, 0x0000ff ], [ 0.25, 0x6666ff ], [ 0.5, 0xccccff ], [ 0.75, 0xffcccc ],  [ 1.0, 0xff6666 ] ],
    "seismic":	[ [ 0.0, 0x00004c ], [ 0.25, 0x0000db ], [ 0.5, 0x9999ff ], [ 0.75, 0xff9999 ],  [ 1.0, 0xe60000 ] ],
    "hsv":	[ [ 0.0, 0xff0000 ], [ 0.25, 0xd1ff00 ], [ 0.5, 0x00ff5c ], [ 0.75, 0x0074ff ],  [ 1.0, 0xb900ff ] ],
    "flag":	[ [ 0.0, 0xff0000 ], [ 0.25, 0xffce9d ], [ 0.5, 0xd6f3ff ], [ 0.75, 0x294fff ],  [ 1.0, 0x00009d ] ],
    "prism":	[ [ 0.0, 0xff0000 ], [ 0.25, 0xff2a00 ], [ 0.5, 0xff9500 ], [ 0.75, 0xffeb00 ],  [ 1.0, 0xbdff00 ] ],
    "ocean":	[ [ 0.0, 0x008000 ], [ 0.25, 0x003333 ], [ 0.5, 0x001a66 ], [ 0.75, 0x006699 ],  [ 1.0, 0x66b3cc ] ],
    "gist_earth":	[ [ 0.0, 0x000000 ], [ 0.25, 0x225e7c ], [ 0.5, 0x3e915b ], [ 0.75, 0x8eac56 ],  [ 1.0, 0xc4a46f ] ],
    "terrain":	[ [ 0.0, 0x333399 ], [ 0.25, 0x00b2b2 ], [ 0.5, 0x99eb85 ], [ 0.75, 0xccbe7d ],  [ 1.0, 0x997c76 ] ],
    "gist_stern":	[ [ 0.0, 0x000000 ], [ 0.25, 0x463366 ], [ 0.5, 0x6666cc ], [ 0.75, 0x999992 ],  [ 1.0, 0xcccc3f ] ],
    "gnuplot":	[ [ 0.0, 0x000000 ], [ 0.25, 0x7202f3 ], [ 0.5, 0xa11096 ], [ 0.75, 0xc63700 ],  [ 1.0, 0xe48300 ] ],
    "gnuplot2":	[ [ 0.0, 0x000000 ], [ 0.25, 0x0000cc ], [ 0.5, 0x7800ff ], [ 0.75, 0xff5ca3 ],  [ 1.0, 0xffc23d ] ],
    "CMRmap":	[ [ 0.0, 0x000000 ], [ 0.25, 0x3d26a6 ], [ 0.5, 0xad366e ], [ 0.75, 0xeb7308 ],  [ 1.0, 0xe6cf42 ] ],
    "cubehelix":	[ [ 0.0, 0x000000 ], [ 0.25, 0x163d4e ], [ 0.5, 0x54792f ], [ 0.75, 0xd07e93 ],  [ 1.0, 0xc1caf3 ] ],
    "brg":	[ [ 0.0, 0x0000ff ], [ 0.25, 0x660099 ], [ 0.5, 0xcc0033 ], [ 0.75, 0xcc3300 ],  [ 1.0, 0x669900 ] ],
    "gist_rainbow":	[ [ 0.0, 0xff0029 ], [ 0.25, 0xffea00 ], [ 0.5, 0x00ff00 ], [ 0.75, 0x00ecff ],  [ 1.0, 0x2a00ff ] ],
    "rainbow":    [ [ 0.0, 0x0000FF ], [ 0.2, 0x00FFFF ], [ 0.5, 0x00FF00 ], [ 0.8, 0xFFFF00 ],  [ 1.0, 0xFF0000 ] ],
    "rainbow_mpl":	[ [ 0.0, 0x8000ff ], [ 0.25, 0x1996f3 ], [ 0.5, 0x4df3ce ], [ 0.75, 0xb2f396 ],  [ 1.0, 0xff964f ] ],
    "jet":	[ [ 0.0, 0x000080 ], [ 0.25, 0x004cff ], [ 0.5, 0x29ffce ], [ 0.75, 0xceff29 ],  [ 1.0, 0xff6800 ] ],
    "nipy_spectral":	[ [ 0.0, 0x000000 ], [ 0.25, 0x0000dd ], [ 0.5, 0x00aa88 ], [ 0.75, 0x00ff00 ],  [ 1.0, 0xff9900 ] ],
    "gist_ncar":	[ [ 0.0, 0x000080 ], [ 0.25, 0x00edff ], [ 0.5, 0x74e800 ], [ 0.75, 0xffce05 ],  [ 1.0, 0xf107ff ] ]
};

export { Lut, ColorMapKeywords };
