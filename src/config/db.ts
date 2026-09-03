import mongoose from 'mongoose';
import { env } from './env';

function getMongoUriDiagnostics(uri: string) {
  try {
    const parsed = new URL(uri);
    return {
      scheme: parsed.protocol.replace(':', ''),
      host: parsed.hostname,
      port: parsed.port || '(default)',
      database: parsed.pathname.replace(/^\//, '') || '(missing)',
      hasUsername: Boolean(parsed.username),
      hasPassword: Boolean(parsed.password),
      hasQueryParams: Boolean(parsed.search),
      isAtlasSrv: uri.startsWith('mongodb+srv://'),
    };
  } catch {
    return { parseError: true };
  }
}

export async function connectDatabase(): Promise<void> {
  const uriDiagnostics = getMongoUriDiagnostics(env.MONGODB_URI);

  // #region agent log
  fetch('http://127.0.0.1:7868/ingest/e103a877-46af-4069-b658-a72c70fd5449',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'855c47'},body:JSON.stringify({sessionId:'855c47',runId:'pre-fix',hypothesisId:'H2-H3-H5',location:'db.ts:connectDatabase:entry',message:'Mongo connect attempt',data:{uriDiagnostics,nodeEnv:env.NODE_ENV},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(env.MONGODB_URI);

    // #region agent log
    fetch('http://127.0.0.1:7868/ingest/e103a877-46af-4069-b658-a72c70fd5449',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'855c47'},body:JSON.stringify({sessionId:'855c47',runId:'pre-fix',hypothesisId:'ALL',location:'db.ts:connectDatabase:success',message:'Mongo connected',data:{readyState:mongoose.connection.readyState,host:mongoose.connection.host,name:mongoose.connection.name},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    console.log('MongoDB connected');
  } catch (err: unknown) {
    const error =
      err && typeof err === 'object'
        ? (err as {
            name?: string;
            message?: string;
            code?: string;
            reason?: { type?: string };
          })
        : { message: String(err) };

    // #region agent log
    fetch('http://127.0.0.1:7868/ingest/e103a877-46af-4069-b658-a72c70fd5449',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'855c47'},body:JSON.stringify({sessionId:'855c47',runId:'pre-fix',hypothesisId:'H1-H4',location:'db.ts:connectDatabase:error',message:'Mongo connect failed',data:{errorName:error.name,errorCode:error.code,errorMessage:error.message?.slice(0,200),topologyType:error.reason?.type,uriDiagnostics},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    throw err;
  }
}
