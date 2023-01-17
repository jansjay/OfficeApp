#Refer https://www.baeldung.com/openssl-self-signed-cert
#Password used is Password1
#Use the latest openssl version > 3.0
mkdir certs
cd certs
echo openssl req -x509 -sha256 -days 1825 -newkey rsa:2048 -keyout officeapp-dev.ca.key -out officeapp-dev.ca.crt 
openssl req -x509 -sha256 -days 1825 -newkey rsa:2048 -keyout officeapp-dev.ca.key -out officeapp-dev.ca.crt 
echo openssl req -newkey rsa:2048 -keyout officeapp-dev.ssl.key -out officeapp-dev.ssl.csr 
openssl req -newkey rsa:2048 -keyout officeapp-dev.ssl.key -out officeapp-dev.ssl.csr 
echo openssl x509 -req -CA officeapp-dev.ca.crt -CAkey officeapp-dev.ca.key -in officeapp-dev.ssl.csr -out officeapp-dev.ssl.crt -days 365 -CAcreateserial -extfile domain.ext
openssl x509 -req -CA officeapp-dev.ca.crt -CAkey officeapp-dev.ca.key -in officeapp-dev.ssl.csr -out officeapp-dev.ssl.crt -days 365 -CAcreateserial -extfile domain.ext
echo openssl pkcs12 -export -in officeapp-dev.ssl.crt -inkey officeapp-dev.ssl.key -out officeapp-dev.ssl.p12 -certfile officeapp-dev.ca.crt
openssl pkcs12 -export -in officeapp-dev.ssl.crt -inkey officeapp-dev.ssl.key -out officeapp-dev.ssl.p12 -certfile officeapp-dev.ca.crt
