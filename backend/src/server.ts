import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { errorHandler } from './middleware/errorHandler';
import { memberRouter } from './routes/memberRoutes';
import { bookRouter } from './routes/bookRoutes';
import { adminRouter } from './routes/adminRoutes';
import { statsRouter } from './routes/statsRoutes';
import { reservationRouter } from './routes/reservationRoutes';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 */
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use('/api/member', memberRouter);
app.use('/api/reservations', reservationRouter);
app.use('/api/books', bookRouter);
app.use('/api/admin', adminRouter);
app.use('/api/stats', statsRouter);

app.use(errorHandler);

const port = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend API server listening on port ${port}`);
  });
}

export default app;


