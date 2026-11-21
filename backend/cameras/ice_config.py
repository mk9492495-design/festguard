
ICE_SERVERS = [
    {
        "urls": ["stun:stun.l.google.com:19302"]
    }
]

def get_ice_configuration():
    return {
        "iceServers": ICE_SERVERS
    }
