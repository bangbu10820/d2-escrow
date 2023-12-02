<!-- 
Viết 1 contract kí quỹ: hỗ trợ nhiều nhiều lần gửi, của người khác nhau
Người gửi:
- có thể gửi ERC20 vào contract, 
- định nghĩa địa chỉ ví nào là người có thể rút tiền
- định nghĩa deadline rút tiền
  - sau deadline ko rút tiền, thì người người được rút tiền tiền
Người nhận:
- được rút tiền trong thời hạn cho phép

q1: Address1 - Address2
q2: Address2 - Address3 <- Address3 chỉ được rút tiền từ q2, không được rút tiền từ q1
q3: Address3 - Address4 
-->