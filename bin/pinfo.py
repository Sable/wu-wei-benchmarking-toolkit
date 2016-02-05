
import platform
import sys
import os

def getInfo():
    info = getHardwareInfo()
    text = ['{']
    addItem(text,'type'      ,'platform')
    addItem(text,'short-name', info[0])
    addItem(text,'name'      , info[1])
    addItem(text,'cpu'       , info[2])
    addItem(text,'gpu'       , info[3])
    addItem(text,'memory'    , info[4])
    addItem(text,'os'        , info[5])
    addItem(text,'supported-languages', info[6])
    addItem(text,'supported-formats'  , [], '') #last item
    text.append('}')
    return text

def addItem(text,a,b,op=','):
    rval = ''
    if type(b) is list:
        rval = '['
        if len(b) > 0:
            rval += '"' + b[0] + '"'
            for one in b[1:]:
                rval += ', "' + one + '"'
        rval += ']'
    else:
        rval = '"' + str(b) + '"'
    text.append('\t"' + str(a) + '": ' + str(rval) + op)

# return: [system name, GPU model, memory, cpu]
def getHardwareInfo():
    info = []
    #info.append(getpass.getuser())  # [0]
    info.append(platform.node())     # [0]
    info.append(platform.platform()) # [1]
    if sys.platform == 'win32':
        info.append(getWindowCmd('wmic path win32_processor get name'))       # [2]
        info.append(getWindowCmd('wmic path win32_VideoController get name')) # [3]
        info.append(getWindowMem())                                           # [4]
        osrelease,_,osinfo,_ = platform.win32_ver()
        info.append('Windows ' + osrelease + ' ' + osinfo)                    # [5]
    elif sys.platform == 'darwin':
        info[0] = trimA(os.popen('system_profiler SPSoftwareDataType | grep "Computer Name"').read())
        info.append(trimA(os.popen('system_profiler SPHardwareDataType | grep "Processor Name"').read())) # [2]
        info.append(trimA(os.popen('system_profiler SPDisplaysDataType | grep Model').read()))            # [3]
        info.append(trimA(os.popen('system_profiler SPHardwareDataType | grep Memory').read()))           # [4]
        v,_,_ = platform.mac_ver(); info.append('Mac OS X ' + v)                                          # [5]
    elif sys.platform.startswith('linux'):
        #print 'linux'
        info.append(trimB(os.popen('cat /proc/cpuinfo | grep "model name"').read())); # [2]
        info.append(getLinuxGPU());                                                   # [3]
        info.append(trimC(os.popen('cat /proc/meminfo | grep MemTotal').read()));     # [4]
        osname,osver,oscode = platform.dist()
        info.append(osname + ' ' + osver + ' ' + oscode);                             # [5]
    else:
        print 'Not supported.'
        sys.exit(99)
    info.append(getArc(platform.machine())); # [6]
    return info

def trimA(s):
    return s[s.index(':')+1:].strip()

def trimB(s, startop=':', endop='\n'):
    sta = s.index(startop)   + len(startop)
    end = s.index(endop,sta)
    return s[sta:end].strip()

def trimC(s):
    numstr = s[s.index(':')+1:s.index('kB')-1].strip()
    return kb2gb(float(numstr))

def trimD(s):
    return s.strip('\r\n\t ')

def getLinuxGPU():
    strs = os.popen('lspci | grep VGA').read().strip().split('\n')
    res  = []
    for line in strs:
        if 'NVIDIA' in line:
            res.append(trimB(line,'[',']'))
        else:
            res.append(trimB(line,'controller:','('))
    return res

def getWindowCmd(cmd, op=True):
    strs = os.popen(cmd).read().strip().split('\n')
    r = []
    if len(strs) == 2 and op:
        r = strs[1]
    elif len(strs) > 0:
        for line in strs[1:]:
            if len(trimD(line)) > 0:
                r.append(trimD(line))
    return r
    
def getWindowMem():
    total = getWindowCmd('wmic path win32_physicalmemory get Capacity', False)
    res = 0
    for num in total:
        res += int(num)
    return kb2gb(res,3)
    
def kb2gb(val,op=2):
    return '%g GB' % (val/(1024**op))

# convert architecture
def getArc(a):
    r = ''
    if a in ['x86-64','x64','x86_64','AMD64','amd64']:
        r = ['x86_64']
    elif a in ['x86','i386']:
        r = ['x86']
    else:
        print 'Not supported architecture: ' + str(a)
    return r

def prettyPrint(s):
    for item in s:
        print item

if __name__ == '__main__':
    #print platform.platform()
    #print platform.uname()
    #print platform.version()
    #print platform.dist()         # ('', '', '')
    #print platform.machine()      # x86_64
    #print platform.processor()    # i386
    #print platform.architecture() # ('64bit', '')
    #print platform.system()       # Darwin
    prettyPrint(getInfo())

# wmic list
# http://superuser.com/questions/331220/wmic-path-what-wmic-class-what
