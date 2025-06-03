declare module 'd3-regression' {
    export function regressionLinear<T = any>(): {
        x: (d: T) => number;
        y: (d: T) => number;
        domain: (domain: [number, number]) => any;
        (data: T[]): [number, number][];
    };
} 