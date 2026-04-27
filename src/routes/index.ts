import { Router } from 'express';
import { demoRouter } from './demo.routes';

export const apiRouter: Router = Router();

apiRouter.use('/demo', demoRouter);
