import { Router } from 'express'
import { postEnqueueDemo, postLoggerDemo } from '../controllers/demo.controller'

export const demoRouter: Router = Router()

demoRouter.post('/enqueue', postEnqueueDemo)
demoRouter.post('/logger', postLoggerDemo)
