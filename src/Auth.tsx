import { useState } from 'react';
import { supabase } from './supabaseClient';

export default function Auth() {
	const [loading, setLoading] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [isSignUp, setIsSignUp] = useState(false); // ログインと新規登録の切り替え用

	const handleAuth = async () => {
		setLoading(true);

		if (isSignUp) {
			// 新規ユーザー登録
			const { error } = await supabase.auth.signUp({ email, password });
			if (error) {
				alert('登録エラー: ' + error.message);
			} else {
				alert('登録が完了しました！確認メールが届いているかご確認ください。');
			}
		} else {
			// ログイン
			const { error } = await supabase.auth.signInWithPassword({ email, password });
			if (error) alert('ログインエラー: ' + error.message);
		}
		setLoading(false);
	};

	return (
		<div className="min-h-screen bg-olive-50 flex items-center justify-center p-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-olive-100 p-8">
				<div className="text-center mb-8">
					<h1 className="text-2xl font-bold tracking-wide text-olive-800">体調管理app</h1>
					<p className="text-xs text-olive-500 mt-1">
						{isSignUp ? 'アカウントを作成して始めましょう' : '大切な家族の体調管理にログイン'}
					</p>
				</div>

				<form action={handleAuth} className="space-y-4">
					<div>
						<label className="block text-xs font-bold text-olive-500 mb-1">メールアドレス</label>
						<input
							type="email"
							placeholder="your@email.com"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="w-full bg-olive-50 border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
							required
						/>
					</div>

					<div>
						<label className="block text-xs font-bold text-olive-500 mb-1">パスワード</label>
						<input
							type="password"
							placeholder="••••••••"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="w-full bg-olive-50 border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
							required
						/>
					</div>

					<button
						type="submit"
						disabled={loading}
						className="w-full bg-lime-400 hover:bg-lime-500 text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm disabled:bg-olive-300"
					>
						{loading ? '処理中...' : isSignUp ? '新規登録する' : 'ログインする'}
					</button>
				</form>

				<div className="text-center mt-6">
					<button
						type="button"
						onClick={() => setIsSignUp(!isSignUp)}
						className="text-xs text-lime-500 hover:underline font-medium"
					>
						{isSignUp ? 'すでにアカウントをお持ちの方（ログイン）' : '初めてご利用の方（アカウント登録）'}
					</button>
				</div>
			</div>
		</div>
	);
}
// End of code. (to AI)