// 農曆資料表：1899 到 2100 年，每年一個數字（36 進位），不依賴瀏覽器的曆法功能。
// 每個數字由三段組成：
//   低 13 位元：這一年每個月是大月（30 天，記 1）還是小月（29 天，記 0），依實際順序，含閏月
//   接著 4 位元：閏哪一個月（0 表示沒有閏月）
//   再往上：正月初一是國曆 1 月 1 日之後的第幾天
// 這張表是用 Chrome 內建的農曆曆法逐日產生的，產生後又逐日比對過。
const LUNAR_FIRST_YEAR = 1899;
const LUNAR_TABLE = (
  "34fkl,2dt5e,3tp3m,2yu1x,27nt6,3l9hn,2nkpn,1w8ra,3ctwq,2hyl5,1nh3m,34evm,2ao85,3qwpx,2t6x7,1z82z,3fmi5,2kqjv,1qe7d,3799l,"
  + "2ghaq,3wjo2,2ytr9,251sd,3laae,2qcae,1tfp1,3cu6s,2hz8p,1qbo2,34gb6,2algm,3o2ej,2t6xj,1z7p2,3fo7u,2njys,1t809,37809,2dms3,"
  + "3tpqr,2ys6j,225i3,3ih7x,2qctm,1w9xx,3cv50,2hykp,1nhqr,34fit,2808d,3o2eu,2t6zx,221ey,3fooi,2nlb8,1tavd,3a2bu,2dqqd,3qwlz,"
  + "2ys7q,24yph,3ih91,2qd3m,1w7fp,3cvqd,2hxl6,1ks5z,31me3,2atei,3o2ga,2t755,221qq,3ihci,2krol,1qmob,378ln,2dsq3,3qv1p,2vz3h,"
  + "24yuh,3lay1,2qefm,1waat,3cvfp,2jsr1,3wity,31kty,27x6d,3o2qd,2t7s9,2236a,3ihzm,2nl7q,1qdzq,34fh3,2dsra,3tobe,2vzdh,24t6x,"
  + "3l9op,2qd1v,1tfl7,3a0q3,2f597,1ngpm,31ld6,281g5,3qwtg,2w095,1z98z,3fo2d,2kqi5,1qkbx,34fjp,2dz8q,3tosy,2ytut,252dm,3lb2i,"
  + "2qe8l,1w8q6,3a0ra,2f5bp,1ngs2,34es2,27smd,3o4dh,2vz9m,1z6hj,3ctrf,2hxej,1qe3a,378tl,2ec7m,3tpw2,2ytd1,251sb,3ih57,2njjf,"
  + "1tisb,3a0tp,2f5gq,1nhw2,34g42,2auxx,3o3z9,2t6xh,1z831,3fmwm,2hxh1,1qene,379hl,2gnte,3tqj6,2ytra,24ymu,3ih5j,2njkm,1tcr9,"
  + "3a15h,2hxs9,1ksk3,31llf,2808b,3o2ej,2qdsr,1z87u,3fn1m,2krqd,1qmve,378sp,2dtw5,3tpqt,2vz1p,225kd,3ih85,2qcve,1tdph,3a2ed,"
  + "2hyyy,1nogl,31ms6,2811q,3o2fq,2t705,1z8aa,3fnbm,2ksdh,1te8a,34eq3,2axzr,3qvfv,2vz2z,225li,3ihd6,2qd76,1w945,3a1xh,2f5aj,"
  + "1knff,31l7v"
).split(",").map((text) => parseInt(text, 36));
