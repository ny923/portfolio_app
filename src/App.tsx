import { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient';
import Auth from './Auth'; // ログイン画面
import type { Session } from '@supabase/supabase-js'; // セッションの型定義
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'; // グラフ用の部品

// for pets table(Supabase)
interface Pet {
	id: string;
	created_at: string;
	user_id: string;
	name: string;
	allergy: string;
	sex: string;
	age: string;
	default_weight: number;
}

// for logs table(Supabase)
interface Log {
	id: number;
	created_at: string;
	user_id: string;
	pet_id: string;
	weight: number;
	poop_status: string;
	skin_status: string;
	food_note: string;
	dosage_note: string;
	note: string;
	image_url: string | null; // 画像がない場合はnull
}

export default function App() {
	const fileInputRef = useRef<HTMLInputElement>(null);

	// ログイン状態(セッション)を管理するState(型安全)
	const [session, setSession] = useState<Session | null>(null);
	const [authLoading, setAuthLoading] = useState(true);

	// pet情報をDBから取得するState
	const [pets, setPets] = useState<Pet[]>([]); //初期値は空の配列
	const [selectedPetId, setSelectedPetId] = useState('');
	const [logs, setLogs] = useState<Log[]>([]);
	const [loading, setLoading] = useState(true);

	// ペット追加フォーム用のState
	const [newPetName, setNewPetName] = useState('');
	const [newPetAllergy, setNewPetAllergy] = useState('');
	const [newPetSex, setNewPetSex] = useState('');
	const [newPetAge, setNewPetAge] = useState('');
	const [newPetWeight, setNewPetWeight] = useState('');
	const [showPetForm, setShowPetForm] = useState(false); // フォームの開閉用

	// ペット編集フォーム用
	const [editPetName, setEditPetName] = useState('');
	const [editPetAge, setEditPetAge] = useState('');
	const [editPetAllergy, setEditPetAllergy] = useState('');
	const [editPetSex, setEditPetSex] = useState('');
	const [editPetWeight, setEditPetWeight] = useState('');
	const [showEditPetForm, setShowEditPetForm] = useState(false);

	// 体調入力フォーム用
	const [weight, setWeight] = useState('');
	const [poopStatus, setPoopStatus] = useState('良好');
	const [skinStatus, setSkinStatus] = useState('良好');
	const [food_note, setFoodNote] = useState('');
	const [dosage_note, setDosageNote] = useState('');
	const [note, setNote] = useState('');

	// 画像ファイル用のState
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false); // loading img用

	// 選択中のペット情報と、そのペットのログの抽出
	const currentPet = pets.find(pet => pet.id === selectedPetId);
	const filteredLogs = logs.filter((log) => log.pet_id === selectedPetId);

	// グラフ用にデータを古い順に並び替えて整形
	const graphData = [...filteredLogs]
		.reverse() // 配列をひっくり返す
		.map((log) => ({
			// X軸に表示する日付(例: "6/15")
			date: new Date(log.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
			// Y軸に表示する体重
			weight: log.weight,
		}));

	// ログイン状態の監視(アプリ起動時 ＆ 状態変化時)
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setSession(session);
			setAuthLoading(false);
		});

		const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
			setSession(session);
		});

		return () => subscription.unsubscribe();
	}, []);

	// Supabaseから「ペット一覧」を取得
	const fetchPets = async (userId: string) => {
		const { data, error } = await supabase
			.from('pets')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: true });

		if (error) {
			console.error('ペットデータ取得エラー:', error);
		} else {
			setPets(data || []);
			// まだペットが選択されておらず、ペットが1頭以上いれば、最初の1頭を自動選択
			if (data && data.length > 0) {
				setSelectedPetId(data[0].id);
			}
		}
	};

	// Supabaseから「体調ログ」を取得
	const fetchLogs = async (userId: string) => {
		const { data, error } = await supabase
			.from('logs')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });
		if (error) {
			console.error('データ取得エラー:', error);
		} else {
			setLogs(data || []);
		}
		setLoading(false);
	};

	// ログインセッションが確定したら、ペットとログを両方取得
	// fetchPets と fetchLogs から setLoading(false) を外し、呼び出し側で一括管理する
	useEffect(() => {
		if (!session?.user) return; // ログインしていなければスキップ

		const loadData = async () => {
			setLoading(true);
			// 2つの非同期処理を同時に走らせ、両方終わるのを待つ
			await Promise.all([
				fetchPets(session.user.id),
				fetchLogs(session.user.id)
			]);
			setLoading(false);
		};

		loadData();
	}, [session]);

	// 新しいペットを登録する処理
	const handleAddPet = async () => {
		if (!session?.user || !newPetName) return;

		const newPet = {
			user_id: session.user.id,
			name: newPetName,
			allergy: newPetAllergy || '特になし',
			sex: newPetSex || '不明',
			age: newPetAge || '不明',
			default_weight: newPetWeight ? parseFloat(newPetWeight) : 4.0
		};

		const { data, error } = await supabase
			.from('pets')
			.insert([newPet])
			.select(); // 挿入したデータを戻り値として受け取る

		if (error) {
			alert('ペットの登録に失敗しました: ' + error.message);
		} else {
			// 再取得してフォームを閉じる
			await fetchPets(session.user.id);
			setNewPetName('');
			setNewPetAllergy('');
			setNewPetSex('');
			setNewPetAge('');
			setNewPetWeight('');
			setShowPetForm(false);
			// 新しく追加したペットをそのまま選択状態にする
			if (data && data.length > 0) {
				setSelectedPetId(data[0].id);
			}
		}
	};

	// ペット情報の編集を開始する処理(現在の値をフォームにセットする)
	const startEditPet = () => {
		if (!currentPet) return;
		setEditPetName(currentPet.name);
		setEditPetAge(currentPet.age);
		setEditPetAllergy(currentPet.allergy);
		setEditPetSex(currentPet.sex);
		setEditPetWeight(currentPet.default_weight.toString());
		setShowEditPetForm(true);
		setShowPetForm(false); // 追加フォームが開いていたら閉じる
	};

	// ペット情報をSupabaseで更新(Update)する処理
	const handleUpdatePet = async () => {
		if (!session?.user || !currentPet) return;

		const updatedPet = {
			name: editPetName,
			allergy: editPetAllergy || '特になし',
			sex: editPetSex || '不明',
			age: editPetAge || '不明',
			default_weight: editPetWeight ? parseFloat(editPetWeight) : 4.0
		};

		const { error } = await supabase
			.from('pets')
			.update(updatedPet) // 指定した項目だけを上書き
			.eq('id', currentPet.id); // どのペットかをIDで指定

		if (error) {
			alert('ペット情報の更新に失敗しました: ' + error.message);
		} else {
			alert('ペット情報を更新しました！');
			await fetchPets(session.user.id); // 最新のペット一覧を再取得
			setShowEditPetForm(false); // フォームを閉じる
		}
	};

	// 体調ログ送信時の処理
	const handleSubmit = async () => {
		if (!session?.user || !currentPet) return;
		setUploading(true);
		let uploadedImageUrl = '';
		// もし画像が選択されていたら、先にSupabase Storageにアップロード
		if (imageFile) {
			// ファイル名が被らないように「タイムスタンプ_ファイル名」にする
			const fileExt = imageFile.name.split('.').pop();
			const fileName = `${Date.now()}.${fileExt}`;
			const filePath = `${session.user.id}/${currentPet.id}/${fileName}`; // セキュリティのため画像ストレージのパスもユーザーIDでフォルダ分け

			const { error: uploadError } = await supabase.storage
				.from('pet-photos')
				.upload(filePath, imageFile);

			if (uploadError) {
				alert('画像のアップロードに失敗しました: ' + uploadError.message);
				setUploading(false);
				return;
			}

			// アップロードした画像のパブリックURL(公開URL)を取得
			const { data } = supabase.storage
				.from('pet-photos')
				.getPublicUrl(filePath);

			uploadedImageUrl = data.publicUrl;
		}

		// DBに保存するオブジェクトを作成
		const newLog = {
			user_id: session.user.id, // 誰の投稿か?
			pet_id: currentPet.id, // 現在選択されているID
			weight: weight ? parseFloat(weight) : (currentPet?.default_weight || 4.0), // 未入力ならデフォルト
			poop_status: poopStatus,
			skin_status: skinStatus,
			food_note: food_note,
			dosage_note: dosage_note,
			note: note,
			image_url: uploadedImageUrl // 画像URLを一緒に保存
		};

		// Supabaseの `logs` テーブルに挿入(Insert)する
		const { error } = await supabase
			.from('logs')
			.insert([newLog]);

		if (error) {
			alert('保存に失敗しました：' + error.message);
		} else {
			fetchLogs(session.user.id);
			setWeight('');
			setPoopStatus('良好');
			setSkinStatus('良好');
			setFoodNote('');
			setDosageNote('');
			setNote('');
			setImageFile(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = '';
			}
		}
		setUploading(false);
	};

	// ログアウト処理
	const handleLogout = async () => {
		await supabase.auth.signOut();
		setLogs([]); // ログをクリア
		setPets([]);
		setSelectedPetId('');
	};

	// 起動時のロード画面
	if (authLoading) {
		return <div className="min-h-screen bg-olive-50 flex items-center justify-center text-olive-400 text-sm">起動中...</div>;
	}

	// 未ログインならログイン画面を出す
	if (!session) {
		return <Auth />;
	}

	return (
		<div className="min-h-screen bg-olive-50 py-12 px-4 font-sans antialiased">
			<div className="max-w-md md:max-w-full mx-auto bg-white rounded-2xl shadow-sm border border-olive-100 overflow-hidden">

				<header className="bg-gradient-to-r from-lime-400 to-lime-500 p-6 text-white text-center">
					<h1 className="text-2xl font-bold tracking-wide">体調管理app</h1>
					<p className="text-xs opacity-90 mt-1">日々の体調・お腹・皮膚の経過観察</p>

					<button
						onClick={handleLogout}
						className="absolute top-2 md:top-16 right-4 md:right-10 bg-olive-700 hover:bg-olive-500 text-white text-[10px] font-bold py-1 px-2 rounded-md transition-colors"
					>
						ログアウト
					</button>
				</header>

				<div className="p-6 ">

					{/* pet切り替えタブ＆プラスボタン(ユーザーに紐づくペットのみ items-center */}
					<div className="flex flex-col md:flex-row gap-4 mb-6 ">

						<div className="flex gap-4 md:w-1/2">
							{/* ペット追加のボタン */}
							<button
								onClick={() => setShowPetForm(!showPetForm)}
								className="bg-lime-500 text-white font-bold p-6 rounded-xl hover:bg-lime-400 transition-colors shadow-xs"
							>
								{showPetForm ? '✕' : '＋'}
							</button>

							<div className="flex flex-row gap-2 bg-olive-100 p-1 rounded-xl flex-1 overflow-x-auto ">
								{pets.map(pet => {
									const isSelected = selectedPetId === pet.id;
									return (
										<button
											key={pet.id}
											onClick={() => setSelectedPetId(pet.id)}
											className={`flex-1 min-w-[80px] py-2 text-sm font-bold rounded-lg transition-all duration-200 ${isSelected
												? 'bg-white text-lime-500 shadow-sm'
												: 'text-olive-500 hover:text-olive-800'
												}`}
										>
											{pet.name}
										</button>
									);
								})}
								{pets.length === 0 && (
									<p className="text-xs text-olive-400 p-2 text-center w-full">ペットを登録してください</p>
								)}
							</div>
						</div>


						{/* 基本情報カード */}
						{currentPet ? (
							<div className="bg-lime-50/60 border border-lime-100 rounded-xl p-4  md:w-1/2">
								<div className="flex justify-between items-center mb-1">
									<h3 className="font-bold text-olive-800 text-lg">{currentPet?.name}
										{/* 情報編集ボタン */}
										<button
											onClick={startEditPet}
											className="text-olive-400 hover:text-olive-600 p-1 text-sm transition-colors cursor-pointer ml-4"
											title="情報を編集する"
										>
											✏️編集する
										</button>
									</h3>

									<p>
										<span className="text-xs text-olive-800 px-2 py-0.5 rounded-full font-medium">{currentPet?.sex}</span>

										<span className="text-xs bg-lime-200 text-lime-800 px-2 py-0.5 rounded-full font-medium">{currentPet?.age}歳</span>
									</p>
								</div>

								<p className="text-sm text-olive-600 mt-1 flex items-start gap-1">
									<span className="text-lime-500">⚠️</span>
									<span>懸念・アレルギー: <strong className="text-olive-700">{currentPet?.allergy}</strong></span>
								</p>

							</div>
						) : null}
					</div>

					{/* ペット追加フォーム(トグル表示) */}
					{showPetForm && (
						<form
							onSubmit={async (e) => {
								e.preventDefault(); // ページリロードを防止
								await handleAddPet();
							}}
							className="bg-olive-100 rounded-xl p-4 mb-6 border border-olive-200 space-y-3">
							<h4 className="font-bold text-olive-700 text-xs">🐾 新しいペットを登録</h4>
							<div className="grid grid-cols-3 gap-2">
								<input
									type="text" placeholder="名前 (必須)" value={newPetName} onChange={(e) => setNewPetName(e.target.value)}
									className="bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
								/>
								<input
									type="text" placeholder="懸念・アレルギー" value={newPetAllergy} onChange={(e) => setNewPetAllergy(e.target.value)}
									className="bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none col-span-2"
								/>
								<input
									type="text" placeholder="年齢 (例: 5歳)" value={newPetAge} onChange={(e) => setNewPetAge(e.target.value)}
									className="bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none "
								/>
								<input
									type="text" placeholder="性別" value={newPetSex} onChange={(e) => setNewPetSex(e.target.value)}
									className="bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none "
								/>
								<input
									type="number" step="0.1" placeholder="基準体重 (kg)" value={newPetWeight} onChange={(e) => setNewPetWeight(e.target.value)}
									className="bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none "
								/>
							</div>
							<button
								type="submit"
								className="w-full bg-olive-800 text-white font-bold py-1.5 rounded-lg text-xs hover:bg-olive-700 transition-colors"
							>
								ペットを登録する
							</button>
						</form>
					)}

					{/* ペット情報編集フォーム（トグル表示） */}
					{showEditPetForm && currentPet && (
						<form
							onSubmit={async (e) => {
								e.preventDefault();
								await handleUpdatePet();
							}}
							className="bg-lime-50 rounded-xl p-4 mb-6 border border-lime-100 space-y-3">
							<h4 className="font-bold text-lime-800 text-xs flex items-center gap-1">
								<span>✏️</span> {currentPet.name} の情報を編集
							</h4>
							<div className="grid grid-cols-3 gap-2">
								<div>
									<label className="block text-[10px] font-bold text-olive-500 mb-0.5">名前</label>
									<input
										type="text" value={editPetName} onChange={(e) => setEditPetName(e.target.value)}
										className="w-full bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
										required
									/>
								</div>
								<div className="col-span-2">
									<label className="block text-[10px] font-bold text-olive-500 mb-0.5">懸念・アレルギー</label>
									<input
										type="text" value={editPetAllergy} onChange={(e) => setEditPetAllergy(e.target.value)}
										className="w-full bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
									/>
								</div>
								<div >
									<label className="block text-[10px] font-bold text-olive-500 mb-0.5">年齢</label>
									<input
										type="text" value={editPetAge} onChange={(e) => setEditPetAge(e.target.value)}
										className="w-full bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
									/>
								</div>
								<div >
									<label className="block text-[10px] font-bold text-olive-500 mb-0.5">性別</label>
									<input
										type="text" value={editPetSex} onChange={(e) => setEditPetSex(e.target.value)}
										className="w-full bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
									/>
								</div>
								<div >
									<label className="block text-[10px] font-bold text-olive-500 mb-0.5">基準体重 (kg)</label>
									<input
										type="number" step="0.1" value={editPetWeight} onChange={(e) => setEditPetWeight(e.target.value)}
										className="w-full bg-white border border-olive-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
									/>
								</div>
							</div>
							<div className="flex gap-2">
								<button
									type="button" onClick={() => setShowEditPetForm(false)}
									className="flex-1 bg-olive-400 text-olive-700 font-bold py-1.5 rounded-lg text-xs hover:bg-olive-300 transition-colors"
								>
									キャンセル
								</button>
								<button
									type="submit"
									className="flex-1 bg-lime-500 text-white font-bold py-1.5 rounded-lg text-xs hover:bg-lime-400 transition-colors"
								>
									変更を保存
								</button>
							</div>
						</form>
					)}

					{/* 🔥 体重グラフエリア */}
					{!loading && graphData.length > 0 && (
						<div className="bg-white rounded-xl p-4 border border-olive-100 shadow-xs mb-6">
							<h3 className="font-bold text-olive-800 text-xs mb-3 flex items-center gap-1">
								<span>📈</span> 体重の推移 (kg)
							</h3>
							<div className="w-full h-44">
								<ResponsiveContainer width="100%" height="100%">
									<LineChart data={graphData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
										<CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
										<XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
										{/* domainに 'dataMin - 0.1' などを指定して、猫の微小な体重変化を見やすくズーム */}
										<YAxis type="number" domain={['dataMin - 0.2', 'dataMax + 0.2']} tick={{ fontSize: 10, fill: '#94a3b8' }} />
										<Tooltip />
										<Line
											type="monotone"
											dataKey="weight"
											stroke="#9ae600"
											strokeWidth={3}
											dot={{ r: 4, fill: '#9ae600', strokeWidth: 0 }}
											activeDot={{ r: 6 }}
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</div>
					)}

					<div className="p-6 flex gap-10 flex-col md:flex-row">
						<div className='md:flex-1 md:w-1/2'>
							{/*  入力フォーム */}
							{currentPet && (
								<form
									onSubmit={async (e) => {
										e.preventDefault();
										await handleSubmit();
									}}
									className="bg-olive-50 rounded-xl p-4 border border-olive-100 mb-8 space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-4">
									<h3 className="font-bold text-olive-700 text-sm border-b border-olive-200 pb-2">✏️ 本日の記録を入力</h3>

									{/*  写真アップロード入力欄 */}
									<div className="col-span-2">
										<label className="block text-xs font-bold text-olive-500 mb-1">📸 患部の写真を追加</label>
										<input
											ref={fileInputRef} // id の代わりに ref を紐付ける
											type="file"
											accept="image/*"
											onChange={(e) => {
												if (e.target.files && e.target.files[0]) {
													setImageFile(e.target.files[0]);
												}
											}}
											className="w-full text-xs bg-white border border-olive-200 rounded-lg px-3 py-2 text-olive-600 focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-lime-100 file:text-lime-700 hover:file:bg-lime-200"
										/>
									</div>

									{/* 体重入力 */}
									<div>
										<label className="block text-xs font-bold text-olive-500 mb-1">体重 (kg)</label>
										<input
											type="number"
											step="0.01"
											placeholder="4.2"
											value={weight}
											onChange={(e) => setWeight(e.target.value)}
											className="w-full bg-white border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400"
										/>
									</div>

									{/* お腹の状態 */}
									<div >
										<label className="block text-xs font-bold text-olive-500 mb-1">お腹(便)の状態</label>
										<div className="flex gap-2">
											{['良好', '軟便', '下痢'].map(status => {
												const isSelected = poopStatus === status; // 選択中かどうか

												// ステータスごとに色を定義
												const getButtonStyles = (s: string) => {
													if (!isSelected) {
														// 未選択時のデフォルトスタイル
														return "bg-white text-olive-600 border-olive-200 hover:bg-olive-100";
													}
													// 選択時の色分け（状態によって変える）
													switch (s) {
														case '良好':
															return "bg-lime-500 text-white border-lime-500";
														case '軟便':
															return "bg-amber-500 text-white border-amber-500";
														case '下痢':
															return "bg-rose-500 text-white border-rose-500";
														default:
															return "bg-olive-500 text-white border-olive-500";
													}
												};

												return (
													<button
														key={status}
														type="button"
														onClick={() => setPoopStatus(status)}
														className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-all font-bold ${getButtonStyles(status)}`}
													>
														{status}
													</button>
												)
											})}
										</div>
									</div>

									{/* 皮膚の状態 */}
									<div className="col-span-2">
										<label className="block text-xs font-bold text-olive-500 mb-1">皮膚の状態</label>

										<div className="flex gap-2 flex-col md:flex-row">
											{['良好', '痒み、舐め壊し有', '赤み、出血あり'].map(status => {
												const isSelected = skinStatus === status; // 選択中かどうか

												// ステータスごとに色を定義
												const getButtonStyles = (s: string) => {
													if (!isSelected) {
														// 未選択時のデフォルトスタイル
														return "bg-white text-olive-600 border-olive-200 hover:bg-olive-100";
													}
													// 選択時の色分け（状態によって変える）
													switch (s) {
														case '良好':
															return "bg-lime-500 text-white border-lime-500";
														case '痒み、舐め壊し有':
															return "bg-amber-500 text-white border-amber-500";
														case '赤み、出血あり':
															return "bg-rose-500 text-white border-rose-500";
														default:
															return "bg-olive-500 text-white border-olive-500";
													}
												};

												return (
													<button
														key={status}
														type="button"
														onClick={() => setSkinStatus(status)}
														className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-all font-bold ${getButtonStyles(status)}`}
													>
														{status}
													</button>
												)
											})}
										</div>

									</div>

									{/* ご飯・おやつメモ */}
									<div className="col-span-2">
										<label className="block text-xs font-bold text-olive-500 mb-1">ご飯・おやつ</label>
										<textarea
											rows={2}
											placeholder="今食べているご飯や、おやつなど"
											value={food_note}
											onChange={(e) => setFoodNote(e.target.value)}
											className="w-full bg-white border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 resize-none"
										></textarea>
									</div>

									{/* 投薬・サプリメモ */}
									<div className="col-span-2">
										<label className="block text-xs font-bold text-olive-500 mb-1">薬・サプリ</label>
										<textarea
											rows={2}
											placeholder="今投薬しているお薬やサプリなど"
											value={dosage_note}
											onChange={(e) => setDosageNote(e.target.value)}
											className="w-full bg-white border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 resize-none"
										></textarea>
									</div>

									{/* その他備考メモ */}
									<div className="col-span-2">
										<label className="block text-xs font-bold text-olive-500 mb-1">その他備考メモ</label>
										<textarea
											rows={5}
											placeholder="その他備考"
											value={note}
											onChange={(e) => setNote(e.target.value)}
											className="w-full bg-white border border-olive-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-lime-400 resize-none"
										></textarea>
									</div>

									{/* 保存ボタン */}
									<button
										type="submit"
										disabled={uploading}
										className={`col-span-2 w-full text-white font-bold py-2 rounded-lg text-sm transition-colors shadow-sm ${uploading ? 'bg-olive-400 cursor-not-allowed' : 'bg-lime-500 hover:bg-lime-400'
											}`}
									>
										{uploading ? '画像を送信中...' : 'この内容で記録する'}
									</button>
								</form>
							)}
						</div>

						{/* タイムライン表示 */}
						<div className='md:flex-1 md:w-1/2'>
							<h3 className="font-bold text-olive-800 mb-4 flex items-center gap-2">
								<span>📋</span> 過去の記録({currentPet?.name || '---'})
							</h3>

							{loading ? (
								<p className="text-sm text-olive-400 text-center py-4">データを読み込み中...</p>
							) : (
								<div className="space-y-4">
									{filteredLogs.map((log) => (
										<div key={log.id} className="bg-olive-50 rounded-xl p-4 border border-olive-100 md:flex md:items-start md:gap-6">

											<div className="flex-1 md:w-1/2">
												<div className="flex justify-between items-center mb-2">
													{/* Supabaseのcreated_atを日付形式(YYYY-MM-DD)に変換 */}
													<span className="text-sm font-bold text-olive-700">
														{new Date(log.created_at).toLocaleDateString('ja-JP')}
													</span>
													<span className="text-xs text-olive-500 font-medium bg-olive-100 px-2 py-0.5 rounded-sm">{log.weight} kg</span>
												</div>
												{/* タグ表示 */}
												<div className="flex gap-2 mb-2">
													<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.poop_status === '良好' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
														}`}>
														💩 お腹: {log.poop_status}
													</span>
													<span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${log.skin_status === '良好' ? 'bg-lime-50 text-lime-700 border border-lime-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
														}`}>
														✨ 皮膚: {log.skin_status}
													</span>
												</div>
												{log.food_note && <p className="text-sm text-olive-600 leading-relaxed whitespace-pre-wrap">🍚 {log.food_note}</p>}
												{log.dosage_note && <p className="text-sm text-olive-600 leading-relaxed whitespace-pre-wrap">💊 {log.dosage_note}</p>}
												{log.note && <p className="text-sm text-olive-600 leading-relaxed whitespace-pre-wrap">📝 {log.note}</p>}
											</div>

											{/*  過去の記録に画像があれば表示 */}
											{log.image_url && (
												<div className="mb-3 md:mb-0 rounded-lg overflow-hidden border border-olive-200 bg-white md:w-1/2 md:max-h-none md:flex-shrink-0 flex justify-center items-center md:flex-none">
													<img
														src={log.image_url}
														alt="患部の写真"
														className="w-full h-full object-cover"
													/>
												</div>
											)}
										</div>
									))}
									{filteredLogs.length === 0 && (
										<p className="text-sm text-olive-400 text-center py-4">記録がまだありません</p>
									)}
								</div>
							)}
						</div>
					</div>

				</div>
			</div>
		</div>
	);
}
// End of code. (to AI)