const express = require("express");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const { ObjectId } = require('mongodb');
const cors = require("cors");
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const uri = 'mongodb+srv://juu7713:7713@project2024.wuvxb.mongodb.net/?retryWrites=true&w=majority&appName=Project2024';  // DB 연결 주소
const client = new MongoClient(uri);
const app = express();
const router = express.Router();
const storage = multer.diskStorage({
  destination: (req, file, cb) => { // 트레이드 사진 파일 업로드 시 uploads 폴더에 저장
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    const uploadTime = Date.now();
    const originalFileName = file.originalname
      .replace(/[^a-z0-9.\-]/g, '_')
      .slice(0, 50);
      cb(null, `${uploadTime}-${originalFileName}`); // 저장되는 파일 이름: '업로드 시간'- '원본 파일 이름'
  },
});
const upload = multer({ storage });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname));
app.use(cors());
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use(session({
  secret: 'frade-session-secret-key', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } 
}));


async function run() {
    try {
      // 서버 연결
      await client.connect();
      console.log("Connected to MongoDB");

      // 데이터베이스, 컬렉션
      const database = client.db("Frade");
      const users = database.collection("Users");
      const products = database.collection("Products");
      const trades = database.collection("Trades");

      // 페이지 경로지정
      app.get('/main', (req, res) => {  // 메인페이지
        res.sendFile(__dirname + '/public/main.html'); 
      });

      app.get('/start', (req, res) => {  // 시작페이지
        res.sendFile(__dirname + '/public/start.html'); 
      });

      app.get('/login', (req, res) => {  // 로그인 페이지
        res.sendFile(__dirname + '/public/login.html'); 
      });

      app.get('/sign_in', (req, res) => {  // 회원가입 페이지
        res.sendFile(__dirname + '/public/sign_in.html'); 
      });

      app.get('/sign_in_complete', (req, res) => {  // 회원가입 완료페이지
        res.sendFile(__dirname + '/public/sign_in_complete.html'); 
      });

      // 서버 실행
      app.listen(8080, () => {
        console.log('Server is running on http://localhost:8080');
      });

      // 트레이드 ObjectId 유효성 검사
      function isValidTradeId(id) {
        return ObjectId.isValid(id) && String(new ObjectId(id)) === id;
      }

      // 로그인
      app.post('/submit-login', async(req, res) => {
        // 사용자가 입력한 아이디, 비밀번호
        const {loginID, loginPW} = req.body;
        console.log(loginID);
        console.log(loginPW);
        
        // Users 컬렉션에서 해당 계정 찾기
        const loginQuery = {user_id: loginID, password: loginPW};
        const login = await users.findOne(loginQuery);
        
        // 해당 계정 있으면 로그인 성공
        if (login) {
            console.log("로그인 성공");
            // 로그인 유저 정보 세션에 저장
            req.session.user = { id: login.user_id, username: login.username, profile: login.profile_img_url }
            // 메인페이지로 이동
            res.redirect('/main');  
        }
        else {
            console.log("로그인 실패");
            res.send("아이디 혹은 비밀번호를 확인하세요.")
        }
      })

      // 로그인 유저 정보 조회
      app.get('/user-info', (req, res) => {
        if (req.session.user) {
            res.json(req.session.user); // 세션에 저장된 로그인 유저 정보 반환
        } else {
            res.status(401).send('로그인 필요');
        }
      })

      // 로그아웃
      app.post('/logout', (req, res) => {
        req.session.destroy((err) => {  // 세션에 저장된 정보 삭제
            if (err) {
                console.error('세션 삭제 실패:', err);
                res.status(500).send('로그아웃 실패');
            } else {
                res.redirect('/login'); // 로그인 페이지로 이동
            }
        });
      })

      // 회원가입
      app.post('/submit-sign-in', async(req, res) => {
        // 입력 받기
        const {userID, userPW, userPW_confirm, nickname} = req.body;
        console.log(userID);
        console.log(userPW);
        console.log(userPW_confirm);
        console.log(nickname);

        if (!userID || !userPW || !userPW_confirm || !nickname) {
          console.log("모든 항목을 입력해주세요.");
        }
        else {
          // 아이디 중복 확인
          const signInQuery = { user_id: userID };
          const signed = await users.findOne(signInQuery);
          if (signed) {
            console.log("이미 사용중인 아이디입니다.");
          }
          // 비밀번호 확인란 일치 확인
          else if (userPW != userPW_confirm) {
            console.log("비밀번호를 다시 확인해주세요.")
          }
          else {
            // 새로운 회원 Users 컬렉션에 추가
            const newUser = { user_id: userID, password: userPW, username: nickname };
            const result = await users.insertOne(newUser);
            console.log("새로운 회원 추가 (_id: " + result.insertedId + ")");
            // 회원가입 완료 페이지로 이동
            res.redirect('/sign_in_complete');
          }
        }
      })

      // 메인페이지
      // 최근 등록 트레이드 9개 반환
      app.get('/trades-main', async(req, res) => {
        try {
          var query = {};
          var options = {
            sort: { "date": -1 },
            limit: 9,
            projection: { title: 1, prod_id: 1}
          }
          
          const newestTrades = await trades.find(query, options).toArray();
          
          // 각 트레이드의 상품명 찾기
          const resTrades = await Promise.all(newestTrades.map(async trade => {
            try {
                const trade_prod = await products.findOne({ prod_id: trade.prod_id });
                return { // 트레이드id, 제목, 상품명 return
                    trade_id: trade._id,
                    title: trade.title, 
                    prod_name: trade_prod ? trade_prod.prod_name : "Unknown"
                };
            } catch (error) {
                console.error("트레이드 상품명 찾기 오류: ", error);
                return { title: trade.title, prod_name: "Unknown product" };
            }
          }));
          console.log(resTrades); // response 내용 확인
          res.json(resTrades);
        } catch (error) {
          console.error("최근 트레이드 fetch 오류: ", error);
          res.status(500).send("최근 트레이드 fetch 오류");
        }
      })

      // 트레이드 항목 클릭시 트레이드 상세페이지로 이동
      app.get('/trade-info/:tradeID', async(req, res) => {
        // 요청 받은 트레이드 id
        const tradeID = req.params.tradeID;
        // 트레이드 id 유효성 검사
        if (!isValidTradeId(tradeID)) {
          return res.send("유효하지 않은 트레이드 ID");
        }
      
        try {
          // DB에서 해당 트레이드 정보 찾기
          const trade = await trades.findOne({ _id: new ObjectId(tradeID) });
          // 트레이드 작성자 정보 찾기
          const trade_user = await users.findOne({ user_id: trade.user_id });
          // 트레이드 date 형식 설정 (YYYY-MM-DD HH:mm)
          const tradeDate = (date) => {
            const wholeDate = new Date(date);
            const year = wholeDate.getFullYear();
            const month = String(wholeDate.getMonth() + 1).padStart(2, '0');
            const day = String(wholeDate.getDate()).padStart(2, '0');
            const hours = String(wholeDate.getHours()).padStart(2, '0');
            const minutes = String(wholeDate.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day} ${hours}:${minutes}`;
          };
          const trade_date = tradeDate(trade.date);
          // 트레이드 등록 제품 정보 찾기
          const trade_prod = await products.findOne({ prod_id: trade.prod_id });
          // 트레이드 희망 제품 정보 찾기
          const req_prod = await products.findOne({ prod_id: trade.req_prod_id});

          if (trade) {  // 트레이드 정보 표시
            res.render('trade-info', { trade, trade_user, trade_date, trade_prod, req_prod });
          } else {
            res.status(404).send("트레이드를 찾을 수 없습니다.");
          } 
        } catch (error) {
          console.error(error);
          res.status(500).send("오류 발생");
        }  
      })

      // 트레이드 검색
      app.post('/submit-search', async(req, res) => {
        const { word, animal, type, material, brand, effect } = req.body;

        // 검색 조건 설정
        let searchQuery = {};
        // 검색어
        if (word && word.trim() !== "") {
          searchQuery.$or = [ // 브랜드 혹은 상품명에 검색어 포함
            { brand: { $regex: word, $options: "i" } },
            { prod_name: { $regex: word, $options: "i" } }
          ];
        }
        // 검색 필터
        const searchFilters = { animal, type, material, brand, effect };
        for (const [filter, value] of Object.entries(searchFilters)) {
          if (value && value !== 'select') {  // 값이 'select' 아니면 해당 필터 적용
            searchQuery[filter] = { $regex: value, $options: "i" }; 
          }
        }
        // 검색 실행
        try { // 해당 사료 검색
          const searchedProducts = await products.find(
            searchQuery, 
            { projection: { prod_id: 1, prod_name: 1 }} ).toArray();
            // 해당 사료 prod_id, prod_name 매핑
            const prodIds = searchedProducts.map(product => product.prod_id);
            const prodNames = searchedProducts.map(product => product.prod_name);

            
          // 해당 사료에 대한 트레이드 검색
          searchedTrades = await trades.aggregate([
            { $match:  { prod_id: { $in: prodIds } } }, 
            { $lookup: {
                from: "Users",
                localField: "user_id",
                foreignField: "user_id",
                as: "tradeWriter"
              }
            },  
            { $set: {
                tradeWriter: { $arrayElemAt: ["$tradeWriter", 0] },
              },
            },  
            { $set: {
                trade_location: "$tradeWriter.location" 
              }
            },
            { $project: { 
                _id: { $toString: "$_id" },
                title: 1,
                user_id: 1,
                prod_id: 1,
                trade_location: 1,      
              }
            },
      
          ]).toArray();

            // 검색한 트레이드에 사료명 정보 추가
            searchedTrades = searchedTrades.map(trade => {
              const prodName = prodNames[prodIds.indexOf(trade.prod_id)];
              return {
                ...trade,
                prod_name: prodName || "Unknown", // prod_name이 null일 경우 default
              };
            });

          // 검색한 트레이드 -> 검색 결과페이지로 이동
          res.render('search-results', {results: searchedTrades});
          console.log(searchedTrades);
    

        } catch (error) {
          console.error("검색 오류: ", error);
          res.status(500).send("검색 오류");
        }
      })
      
      // 트레이드 등록 시 사진 파일 업로드
      app.post('/upload', upload.single('photo'), (req, res) => {
        if (req.file) {
          const fileUrl = `/uploads/${req.file.filename}`;
          res.json({ filename: req.file.filename, fileUrl });  // 업로드 한 파일 url 보내기
          console.log({ filename: req.file.filename, fileUrl });
        } else {
            res.status(400).send('파일 업로드 실패');
        }
      });

      // 트레이드 등록 시 사료 선택창에서 제품 검색
      app.post('/submit-product-search', async(req, res) => {
        const searchWord = req.body.word;
        console.log(searchWord);

        // 검색어로 해당 사료 검색
        if(searchWord) {
          let searchQuery = {};
          const option = { projection: { prod_id: 1, prod_name: 1, brand:1, img_url:1 } };
          
          if (searchWord.trim() !== "") {
            searchQuery.$or = [ // 브랜드 혹은 상품명에 검색어 포함
              { brand: { $regex: searchWord } },
              { prod_name: { $regex: searchWord} }
            ];
          }
          try { // 해당 product 검색
            const searchedProducts = await products.find(
              searchQuery, option ).toArray();

            console.log(searchedProducts);
            res.json({results: searchedProducts});  
          } catch (error) {
            console.error("제품 검색 오류: ", error);
          }
        }
      })

      // 트레이드 등록(작성)
      app.post('/submit-trade-write', async(req, res) => {
        const tradeContent = req.body;
        console.log(tradeContent);

        // 트레이드 내용 입력 여부 확인
        for (const [field, value] of Object.entries(tradeContent)) {
          if ( !value || value == '') {  
            res.send("트레이드 내용 입력 누락: ", field);
          }
        }
        // Trades DB에 새 트레이드 insert
        const newTrade = {
          title: tradeContent.title,
          user_id: tradeContent.tradeWriterId,
          text: tradeContent.text,
          prod_id: tradeContent.tradeProdId,
          req_prod_id: tradeContent.reqProdId,
          opened: tradeContent.prodOpened,
          trade_img: tradeContent.tradePhotoUrl,
          ubd: tradeContent.prodUbd,
          weight: tradeContent.prodWeight,
          finished: false,
          date: new Date()
        };

        try {
          const insertedTrade = await trades.insertOne(newTrade);
          console.log("새로운 트레이드 등록: ", insertedTrade.insertedId);
          res.redirect('/main');
        } catch (error) {
          console.error('트레이드 등록 오류: ', error);
        }
        
      })
    
    } catch (error) {
        console.error('서버 연결 오류: ', error);
    }
  }
  run().catch(console.dir);
  