

Add below entries to the hosts file (windows C:\Windows\System32\drivers\etc\hosts) and do a dnsflush.



`127.0.0.1 localhost web.officeapp-dev.com`
`127.0.0.1 localhost api.officeapp-dev.com`
`127.0.0.1 localhost tokenhandler.officeapp-dev.com`
`127.0.0.1 localhost openidprovider.officeapp-dev.com`



Run below in command prompt in windows

`ipconfig /flushdns`



Open git bash in windows and run 

`./build_run.sh`