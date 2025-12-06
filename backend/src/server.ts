import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { memberRouter } from './routes/memberRoutes';
import { bookRouter } from './routes/bookRoutes';
import { adminRouter } from './routes/adminRoutes';
import { statsRouter } from './routes/statsRoutes';
import { reservationRouter } from './routes/reservationRoutes';

// 從專案根目錄讀取 .env 檔案（README 目錄）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

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


