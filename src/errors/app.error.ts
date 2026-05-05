

export class AppError extends Error { 


    constructor(public readonly message: string, public readonly statusCode: number, public readonly isOperational:boolean = true) {
        super(message);
        this.name = 'AppError';
        Object.setPrototypeOf(this, AppError.prototype);
    }



}